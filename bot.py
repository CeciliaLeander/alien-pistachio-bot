import os
import io
import json
import uuid
import sqlite3
from datetime import datetime
from PIL import Image
import discord
from discord.ext import commands
from discord import app_commands

# ============ 基础配置 ============
BOT_TOKEN = os.getenv("BOT_TOKEN")
WELCOME_CHANNEL_ID = 1446888253884989515  # 欢迎频道ID

# 新人提问频道跳转链接
NEWBIE_QA_LINK = "https://discord.com/channels/1446888252194816132/1447518124696928357"  # 新人提问频道链接

# 标注图片链接
PINNED_MESSAGE_GUIDE_URL = "https://raw.githubusercontent.com/CeciliaLeander/alien-pistachio-bot/main/pinned-message-guide.png"

# 规则消息跳转链接
RULES_LINK = "https://discord.com/channels/1446888252194816132/1447518124696928357/1474661532779544636"

# 数据存储路径
DATA_DIR = "/data"
FILES_DIR = os.path.join(DATA_DIR, "files")
DB_PATH = os.path.join(DATA_DIR, "bot.db")

# 管理员身份组名称（拥有此身份组的人才能上传/验证）
ADMIN_ROLE_NAME = "Server Booster"

# ============ 确保目录存在 ============
os.makedirs(FILES_DIR, exist_ok=True)

# ============ 数据库初始化 ============
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        version TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL,
        uploaded_by INTEGER NOT NULL,
        uploaded_at TEXT NOT NULL,
        UNIQUE(post_name, file_name, version)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_code TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        file_id INTEGER NOT NULL,
        post_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        version TEXT NOT NULL,
        retrieved_at TEXT NOT NULL,
        FOREIGN KEY (file_id) REFERENCES files(id)
    )''')
    conn.commit()
    conn.close()

init_db()

# ============ Bot 初始化 ============
intents = discord.Intents.default()
intents.members = True
intents.message_content = True
intents.reactions = True

bot = commands.Bot(command_prefix="!", intents=intents)

# ============ 水印工具函数 ============

def generate_tracking_code():
    """生成8位追踪码"""
    return uuid.uuid4().hex[:8].upper()

def is_admin(interaction: discord.Interaction) -> bool:
    """检查用户是否为管理员"""
    return any(role.name == ADMIN_ROLE_NAME for role in interaction.user.roles)

# --- 图片隐写水印（LSB） ---

def text_to_bits(text):
    bits = []
    for char in text:
        byte = ord(char)
        for i in range(7, -1, -1):
            bits.append((byte >> i) & 1)
    return bits

def bits_to_text(bits):
    chars = []
    for i in range(0, len(bits), 8):
        byte_bits = bits[i:i+8]
        if len(byte_bits) < 8:
            break
        byte = 0
        for bit in byte_bits:
            byte = (byte << 1) | bit
        if byte == 0:
            break
        chars.append(chr(byte))
    return ''.join(chars)

def embed_image_watermark(image_bytes, tracking_code):
    """在图片像素最低位嵌入追踪码，肉眼不可见"""
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    pixels = list(img.getdata())

    message = f"<<{tracking_code}>>\x00"
    bits = text_to_bits(message)

    if len(bits) > len(pixels) * 3:
        raise ValueError("图片太小，无法嵌入水印")

    new_pixels = []
    bit_idx = 0
    for pixel in pixels:
        new_pixel = list(pixel)
        for channel in range(3):
            if bit_idx < len(bits):
                new_pixel[channel] = (new_pixel[channel] & 0xFE) | bits[bit_idx]
                bit_idx += 1
        new_pixels.append(tuple(new_pixel))

    new_img = Image.new("RGB", img.size)
    new_img.putdata(new_pixels)

    output = io.BytesIO()
    new_img.save(output, format="PNG")
    output.seek(0)
    return output.getvalue()

def extract_image_watermark(image_bytes):
    """从图片中提取隐藏的追踪码"""
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    pixels = list(img.getdata())

    bits = []
    for pixel in pixels:
        for channel in range(3):
            bits.append(pixel[channel] & 1)

    text = bits_to_text(bits)
    start = text.find("<<")
    end = text.find(">>")
    if start != -1 and end != -1:
        return text[start+2:end]
    return None

# --- JSON 隐形水印（零宽字符） ---

ZERO_WIDTH_CHARS = {
    '0': '\u200b',  # 零宽空格
    '1': '\u200c',  # 零宽非连接符
    '2': '\u200d',  # 零宽连接符
    '3': '\ufeff',  # 零宽不换行空格
    '4': '\u2060',  # 词连接符
    '5': '\u2061',  # 函数应用
    '6': '\u2062',  # 不可见乘号
    '7': '\u2063',  # 不可见分隔符
    '8': '\u2064',  # 不可见加号
    '9': '\u200e',  # 从左到右标记
    'A': '\u200f',  # 从右到左标记
    'B': '\u061c',  # 阿拉伯字母标记
    'C': '\u2066',  # 从左到右隔离
    'D': '\u2067',  # 从右到左隔离
    'E': '\u2068',  # 首字母强隔离
    'F': '\u2069',  # 弹出方向隔离
}

REVERSE_ZERO_WIDTH = {v: k for k, v in ZERO_WIDTH_CHARS.items()}

def embed_json_watermark(json_bytes, tracking_code):
    """在 JSON 文件中用零宽字符嵌入追踪码"""
    content = json_bytes.decode('utf-8')

    # 将追踪码转换为零宽字符
    watermark = ''.join(ZERO_WIDTH_CHARS.get(c, '') for c in tracking_code)

    # 在 JSON 第一个 { 后插入零宽字符
    idx = content.find('{')
    if idx != -1:
        content = content[:idx+1] + watermark + content[idx+1:]
    else:
        content = watermark + content

    return content.encode('utf-8')

def extract_json_watermark(json_bytes):
    """从 JSON 文件中提取零宽字符追踪码"""
    content = json_bytes.decode('utf-8')

    tracking_chars = []
    for char in content:
        if char in REVERSE_ZERO_WIDTH:
            tracking_chars.append(REVERSE_ZERO_WIDTH[char])

    if tracking_chars:
        return ''.join(tracking_chars)
    return None

# ============ Bot 启动事件 ============
@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f"Bot 已上线：{bot.user}")
    print(f"已连接服务器：{[g.name for g in bot.guilds]}")

# ============ 新成员欢迎（私信） ============
@bot.event
async def on_member_join(member):
    welcome_text = (
        f"🎉 欢迎 {member.name} 加入我们的社区！\n"
        "**新人宝宝需要注意的**\n"
        f"1. 社区板块介绍与玩卡规则请查看：{RULES_LINK}\n"
        "2. 阅读完上述内容确认可以接受后，若您不是lc或wbz成员，则可于新人提问区@【发卡组】或名称含有「新人bot」相关的老师礼貌申请卡区身份组：可颂🥐\n"
        "3. 请善用频道标注功能，若有标注则代表着重要消息。\n"
        f"4. 有问题请在对应频道提问：{NEWBIE_QA_LINK}\n\n"
        "祝你在这里玩得开心！"
    )

    # 创建嵌入卡片（用来显示图片）
    embed = discord.Embed()
    embed.set_image(url=PINNED_MESSAGE_GUIDE_URL)

    try:
        await member.send(welcome_text, embed=embed)
    except discord.Forbidden:
        channel = bot.get_channel(WELCOME_CHANNEL_ID) or member.guild.system_channel
        if channel:
            await channel.send(welcome_text, embed=embed)

# ============ 基础指令 ============
@bot.command(name="帮助")
async def help_command(ctx):
    """显示所有可用指令"""
    help_text = (
        "📖 **可用指令：**\n"
        "`!帮助` - 显示此帮助信息\n"
        "`!规则` - 查看社区规范\n"
        "`/回顶` - 跳转到当前频道最早的一条消息\n"
        "`/获取附件` - 获取帖子附件（需先点赞或评论）\n\n"
        "🔧 **管理员指令：**\n"
        "`/上传附件` - 上传文件到指定帖子\n"
        "`/更新附件` - 为已有文件上传新版本\n"
        "`/验证水印` - 上传文件提取追踪码，查出泄露者\n"
        "`/查看记录` - 查看某帖子的所有文件获取记录\n"
        "`/删除附件` - 删除指定帖子下的某个文件版本\n"
    )
    await ctx.send(help_text)

@bot.command(name="规则")
async def rules_command(ctx):
    """查看社区规范"""
    rules_text = (
        "**新人宝宝需要注意的**\n"
        f"1. 社区板块介绍与玩卡规则请查看：{RULES_LINK}\n"
        "2. 阅读完上述内容确认可以接受后，若您不是lc或wbz成员，"
        "则可于新人提问区@【发卡组】或名称为「新人bot相关」的老师礼貌申请卡区身份组：可颂🥐\n"
        "3. 请善用频道标注功能，若有标注则代表着重要消息。\n"
        f"4. 有问题请在对应频道提问：{NEWBIE_QA_LINK}\n\n"
    )
    embed = discord.Embed()
    embed.set_image(url=PINNED_MESSAGE_GUIDE_URL)
    await ctx.send(rules_text, embed=embed)

# ============ 回顶功能 ============
@bot.tree.command(name="回顶", description="跳转到当前频道最早的一条消息")
async def scroll_to_top(interaction: discord.Interaction):
    # 获取频道最早的一条消息
    oldest_messages = [msg async for msg in interaction.channel.history(limit=1, oldest_first=True)]
    if oldest_messages:
        msg = oldest_messages[0]
        link = f"https://discord.com/channels/{interaction.guild_id}/{interaction.channel_id}/{msg.id}"
        await interaction.response.send_message(f"👽 开心果大王乘着UFO来了！👽：{link}", ephemeral=True)
    else:
        await interaction.response.send_message("这个频道还没有消息哦～", ephemeral=True)

# ============ 管理员：上传附件 ============
@bot.tree.command(name="上传附件", description="【管理员】上传文件到指定帖子")
@app_commands.describe(
    帖子链接="帖子的链接（右键帖子→复制链接）",
    文件名="文件的名称（如：角色卡）",
    版本="版本号（如：v1.0）",
    文件="要上传的文件"
)
async def upload_file(interaction: discord.Interaction, 帖子链接: str, 文件名: str, 版本: str, 文件: discord.Attachment):
    if not is_admin(interaction):
        await interaction.response.send_message("❌ 只有管理员才能使用此指令。", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)

    # 从链接解析帖子ID
    try:
        parts = 帖子链接.strip().split('/')
        thread_id = int(parts[-1])
        thread = bot.get_channel(thread_id)
        if thread is None:
            thread = await bot.fetch_channel(thread_id)
        post_name = thread.name
    except Exception as e:
        await interaction.followup.send(f"❌ 链接无效或Bot无法访问该帖子。\n错误信息：{str(e)}", ephemeral=True)
        return

    # 确定文件类型
    if 文件.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        file_type = "image"
    elif 文件.filename.lower().endswith('.json'):
        file_type = "json"
    else:
        file_type = "other"

    # 创建存储目录
    post_dir = os.path.join(FILES_DIR, post_name)
    os.makedirs(post_dir, exist_ok=True)

    # 保存文件
    file_path = os.path.join(post_dir, f"{文件名}_{版本}{os.path.splitext(文件.filename)[1]}")
    file_bytes = await 文件.read()
    with open(file_path, 'wb') as f:
        f.write(file_bytes)

    # 记录到数据库
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute(
            "INSERT INTO files (post_name, file_name, version, file_path, file_type, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (post_name, 文件名, 版本, file_path, file_type, interaction.user.id, datetime.now().isoformat())
        )
        conn.commit()
        await interaction.followup.send(
            f"✅ 文件上传成功！\n"
            f"📁 帖子：{post_name}\n"
            f"📄 文件：{文件名}\n"
            f"🏷️ 版本：{版本}\n"
            f"📦 类型：{file_type}",
            ephemeral=True
        )
    except sqlite3.IntegrityError:
        await interaction.followup.send(f"❌ 该帖子下已存在同名同版本的文件：{文件名} {版本}", ephemeral=True)
    finally:
        conn.close()

# ============ 管理员：更新附件 ============
@bot.tree.command(name="更新附件", description="【管理员】为已有文件上传新版本")
@app_commands.describe(
    帖子链接="帖子的链接（右键帖子→复制链接）",
    文件名="要更新的文件名称",
    新版本="新的版本号（如：v2.0）",
    文件="新版本的文件"
)
async def update_file(interaction: discord.Interaction, 帖子链接: str, 文件名: str, 新版本: str, 文件: discord.Attachment):
    if not is_admin(interaction):
        await interaction.response.send_message("❌ 只有管理员才能使用此指令。", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)

    # 从链接解析帖子ID
    try:
        parts = 帖子链接.strip().split('/')
        thread_id = int(parts[-1])
        thread = bot.get_channel(thread_id) or await bot.fetch_channel(thread_id)
        post_name = thread.name
    except Exception:
        await interaction.followup.send("❌ 链接无效，请右键帖子→复制链接后粘贴。", ephemeral=True)
        return

    # 确定文件类型
    if 文件.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        file_type = "image"
    elif 文件.filename.lower().endswith('.json'):
        file_type = "json"
    else:
        file_type = "other"

    # 保存文件
    post_dir = os.path.join(FILES_DIR, post_name)
    os.makedirs(post_dir, exist_ok=True)
    file_path = os.path.join(post_dir, f"{文件名}_{新版本}{os.path.splitext(文件.filename)[1]}")
    file_bytes = await 文件.read()
    with open(file_path, 'wb') as f:
        f.write(file_bytes)

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute(
            "INSERT INTO files (post_name, file_name, version, file_path, file_type, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (post_name, 文件名, 新版本, file_path, file_type, interaction.user.id, datetime.now().isoformat())
        )
        conn.commit()
        await interaction.followup.send(
            f"✅ 文件更新成功！\n"
            f"📁 帖子：{post_name}\n"
            f"📄 文件：{文件名}\n"
            f"🏷️ 新版本：{新版本}",
            ephemeral=True
        )
    except sqlite3.IntegrityError:
        await interaction.followup.send(f"❌ 版本 {新版本} 已存在。", ephemeral=True)
    finally:
        conn.close()

# ============ 管理员：删除附件 ============
@bot.tree.command(name="删除附件", description="【管理员】删除指定帖子下的某个文件版本")
@app_commands.describe(帖子链接="帖子的链接（右键帖子→复制链接）")
async def delete_file(interaction: discord.Interaction, 帖子链接: str):
    if not is_admin(interaction):
        await interaction.response.send_message("❌ 只有管理员才能使用此指令。", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)

    # 从链接解析帖子ID
    try:
        parts = 帖子链接.strip().split('/')
        thread_id = int(parts[-1])
        thread = bot.get_channel(thread_id)
        if thread is None:
            thread = await bot.fetch_channel(thread_id)
        post_name = thread.name
    except Exception as e:
        await interaction.followup.send(f"❌ 链接无效或Bot无法访问该帖子。\n错误信息：{str(e)}", ephemeral=True)
        return

    # 查询该帖子下的所有文件
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT id, file_name, version FROM files WHERE post_name = ? ORDER BY file_name, uploaded_at DESC",
        (post_name,)
    )
    files = c.fetchall()
    conn.close()

    if not files:
        await interaction.followup.send(f"❌ 帖子「{post_name}」下没有任何文件。", ephemeral=True)
        return

    # 创建文件选择菜单
    class DeleteSelectView(discord.ui.View):
        def __init__(self):
            super().__init__(timeout=60)
            options = [
                discord.SelectOption(
                    label=f"{fname} ({ver})",
                    value=str(fid)
                ) for fid, fname, ver in files
            ]
            self.select = discord.ui.Select(placeholder="选择要删除的文件...", options=options)
            self.select.callback = self.file_selected
            self.add_item(self.select)

        async def file_selected(self, select_interaction: discord.Interaction):
            selected_id = int(self.select.values[0])
            await select_interaction.response.defer(ephemeral=True)

            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute("SELECT file_name, version, file_path FROM files WHERE id = ?", (selected_id,))
            result = c.fetchone()

            if not result:
                conn.close()
                await select_interaction.followup.send("❌ 文件未找到。", ephemeral=True)
                return

            fname, ver, fpath = result

            # 删除实际文件
            try:
                if os.path.exists(fpath):
                    os.remove(fpath)
            except Exception:
                pass

            # 删除数据库记录
            c.execute("DELETE FROM files WHERE id = ?", (selected_id,))
            conn.commit()
            conn.close()

            await select_interaction.followup.send(
                f"✅ 文件已删除！\n"
                f"📄 {fname} ({ver})",
                ephemeral=True
            )

    await interaction.followup.send(
        f"🗑️ 帖子「{post_name}」下的文件，选择要删除的：",
        view=DeleteSelectView(),
        ephemeral=True
    )
    
# ============ 用户：获取附件 ============
@bot.tree.command(name="获取附件", description="获取当前帖子的附件文件（需先点赞首楼或评论）")
async def get_file(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)

    channel = interaction.channel

    # 检查是否在帖子（Thread）中
    if not isinstance(channel, discord.Thread):
        embed = discord.Embed(
            title="🛸 迷路的飞船！",
            description="请在帖子中使用此指令哦～外星开心果的飞船只能降落在帖子里！",
            color=0x00ff88
        )
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    post_name = channel.name
    user = interaction.user

    # ---- 验证用户是否点赞首楼或发过评论 ----
    has_reacted = False
    has_commented = False

    # 检查首楼点赞
    try:
        starter_message = channel.starter_message
        if starter_message is None:
            starter_message = await channel.fetch_message(channel.id)

        if starter_message:
            for reaction in starter_message.reactions:
                async for reaction_user in reaction.users():
                    if reaction_user.id == user.id:
                        has_reacted = True
                        break
                if has_reacted:
                    break
    except Exception:
        pass

    # 检查是否发过评论
    if not has_reacted:
        async for message in channel.history(limit=200):
            if message.author.id == user.id and message.id != channel.id:
                has_commented = True
                break

    if not has_reacted and not has_commented:
        embed = discord.Embed(
            title="🐧 企鹅守卫拦住了你！",
            description="你需要先**点赞帖子首楼** ⭐ 或**发一条评论** 💬 才能获取附件哦～\n\n这是宇宙公约的规定！",
            color=0xff6b6b
        )
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    # ---- 查询该帖子下的可用文件 ----
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT DISTINCT file_name FROM files WHERE post_name = ?", (post_name,))
    file_names = [row[0] for row in c.fetchall()]
    conn.close()

    if not file_names:
        embed = discord.Embed(
            title="🌌 空空的宇宙...",
            description="当前帖子还没有可用的附件，外星开心果正在努力搬运中～",
            color=0x888888
        )
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    # 创建文件选择菜单
    class FileSelectView(discord.ui.View):
        def __init__(self):
            super().__init__(timeout=60)
            options = [discord.SelectOption(label=name, value=name) for name in file_names]
            self.select = discord.ui.Select(placeholder="🪐 选择你想要的文件...", options=options)
            self.select.callback = self.file_selected
            self.add_item(self.select)

        async def file_selected(self, select_interaction: discord.Interaction):
            selected_file = self.select.values[0]

            # 查询该文件的所有版本
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute(
                "SELECT version FROM files WHERE post_name = ? AND file_name = ? ORDER BY uploaded_at DESC",
                (post_name, selected_file)
            )
            versions = [row[0] for row in c.fetchall()]
            conn.close()

            # 创建版本选择菜单
            class VersionSelectView(discord.ui.View):
                def __init__(self):
                    super().__init__(timeout=60)
                    options = [discord.SelectOption(label=v, value=v) for v in versions]
                    self.select = discord.ui.Select(placeholder="✨ 选择版本...", options=options)
                    self.select.callback = self.version_selected
                    self.add_item(self.select)

                async def version_selected(self, version_interaction: discord.Interaction):
                    selected_version = self.select.values[0]
                    await version_interaction.response.defer(ephemeral=True)

                    # 获取文件信息
                    conn = sqlite3.connect(DB_PATH)
                    c = conn.cursor()
                    c.execute(
                        "SELECT id, file_path, file_type FROM files WHERE post_name = ? AND file_name = ? AND version = ?",
                        (post_name, selected_file, selected_version)
                    )
                    result = c.fetchone()
                    conn.close()

                    if not result:
                        await version_interaction.followup.send("❌ 文件未找到。", ephemeral=True)
                        return

                    file_id, file_path, file_type = result

                    # 读取原始文件
                    with open(file_path, 'rb') as f:
                        file_bytes = f.read()

                    # 生成追踪码
                    tracking_code = generate_tracking_code()

                    # 嵌入水印
                    try:
                        if file_type == "image":
                            watermarked_bytes = embed_image_watermark(file_bytes, tracking_code)
                            ext = ".png"
                        elif file_type == "json":
                            watermarked_bytes = embed_json_watermark(file_bytes, tracking_code)
                            ext = ".json"
                        else:
                            watermarked_bytes = file_bytes
                            ext = os.path.splitext(file_path)[1]
                    except Exception as e:
                        await version_interaction.followup.send(f"❌ 水印嵌入失败：{str(e)}", ephemeral=True)
                        return

                    # 记录追踪信息
                    conn = sqlite3.connect(DB_PATH)
                    c = conn.cursor()
                    c.execute(
                        "INSERT INTO tracking (tracking_code, user_id, user_name, file_id, post_name, file_name, version, retrieved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (tracking_code, user.id, user.name, file_id, post_name, selected_file, selected_version, datetime.now().isoformat())
                    )
                    conn.commit()
                    conn.close()

                    # 发送水印文件
                    file_obj = discord.File(
                        io.BytesIO(watermarked_bytes),
                        filename=f"{selected_file}_{selected_version}{ext}"
                    )
                    embed = discord.Embed(
                        title="🛸 外星快递已送达！",
                        description=(
                            f"📄 **{selected_file}** ({selected_version})\n\n"
                            "🔒 此文件已被宇宙追踪系统标记\n"
                            "🐧 企鹅守卫提醒你：请妥善保管，勿外传哦～"
                        ),
                        color=0x00ff88
                    )
                    await version_interaction.followup.send(
                        embed=embed,
                        file=file_obj,
                        ephemeral=True
                    )

            embed = discord.Embed(
                title=f"📄 {selected_file}",
                description="请选择你需要的版本：",
                color=0x7b68ee
            )
            await select_interaction.response.send_message(
                embed=embed,
                view=VersionSelectView(),
                ephemeral=True
            )

    embed = discord.Embed(
        title="🪐 欢迎来到外星开心果的仓库！",
        description="请选择你想要获取的文件：",
        color=0x7b68ee
    )
    await interaction.followup.send(
        embed=embed,
        view=FileSelectView(),
        ephemeral=True
    )

# ============ 管理员：验证水印 ============
@bot.tree.command(name="验证水印", description="【管理员】上传文件提取追踪码，查出泄露者")
@app_commands.describe(文件="要验证的文件")
async def verify_watermark(interaction: discord.Interaction, 文件: discord.Attachment):
    if not is_admin(interaction):
        await interaction.response.send_message("❌ 只有管理员才能使用此指令。", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)

    file_bytes = await 文件.read()

    # 根据文件类型提取水印
    tracking_code = None
    if 文件.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        tracking_code = extract_image_watermark(file_bytes)
    elif 文件.filename.lower().endswith('.json'):
        tracking_code = extract_json_watermark(file_bytes)

    if not tracking_code:
        await interaction.followup.send("❌ 未检测到水印，该文件可能未经过Bot分发或水印已被破坏。", ephemeral=True)
        return

    # 查询追踪记录
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT user_id, user_name, post_name, file_name, version, retrieved_at FROM tracking WHERE tracking_code = ?",
        (tracking_code,)
    )
    result = c.fetchone()
    conn.close()

    if result:
        user_id, user_name, post_name, file_name, version, retrieved_at = result
        await interaction.followup.send(
            f"🔍 **水印验证结果：**\n\n"
            f"🔑 追踪码：`{tracking_code}`\n"
            f"👤 用户：{user_name}（ID: {user_id}）\n"
            f"📁 帖子：{post_name}\n"
            f"📄 文件：{file_name} ({version})\n"
            f"🕐 获取时间：{retrieved_at}",
            ephemeral=True
        )
    else:
        await interaction.followup.send(
            f"🔑 追踪码：`{tracking_code}`\n❌ 数据库中未找到对应记录。",
            ephemeral=True
        )

# ============ 管理员：查看追踪记录 ============
@bot.tree.command(name="查看记录", description="【管理员】查看某个帖子的所有文件获取记录")
@app_commands.describe(帖子名称="要查看的帖子名称")
async def view_tracking(interaction: discord.Interaction, 帖子名称: str):
    if not is_admin(interaction):
        await interaction.response.send_message("❌ 只有管理员才能使用此指令。", ephemeral=True)
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT tracking_code, user_name, file_name, version, retrieved_at FROM tracking WHERE post_name = ? ORDER BY retrieved_at DESC LIMIT 20",
        (帖子名称,)
    )
    records = c.fetchall()
    conn.close()

    if not records:
        await interaction.response.send_message(f"📭 帖子「{帖子名称}」暂无获取记录。", ephemeral=True)
        return

    text = f"📋 **帖子「{帖子名称}」的获取记录（最近20条）：**\n\n"
    for code, user_name, file_name, version, retrieved_at in records:
        text += f"`{code}` | {user_name} | {file_name} ({version}) | {retrieved_at}\n"

    await interaction.response.send_message(text, ephemeral=True)

# ============ 在下方添加新功能 ============

# ============ 启动 Bot ============
bot.run(BOT_TOKEN)
