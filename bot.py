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
        "🔧 **管理员指令：**\n"
        "`/上传附件` - 上传文件到指定帖子\n"
        "`/更新附件` - 为已有文件上传新版本\n"
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


# 示例：添加新事件监听
# @bot.event
# async def on_message_delete(message):
#     print(f"消息被删除：{message.content}")
#
# 示例：添加定时任务
# from discord.ext import tasks
# @tasks.loop(hours=24)
# async def daily_task():
#     channel = bot.get_channel(频道ID)
#     await channel.send("每日提醒！")

# ============ 启动 Bot ============
bot.run(BOT_TOKEN)
