import os
import io
import json
import uuid
import random
import sqlite3
import asyncio
import re
from datetime import datetime, timedelta
from PIL import Image
import discord
from discord.ext import commands, tasks
from discord import app_commands

# ============ 基础配置 ============
BOT_TOKEN = os.getenv("BOT_TOKEN")
WELCOME_CHANNEL_ID = 1446888253884989515  # 欢迎频道ID
GUILD_ID = 1446888252194816132

# 新人提问频道跳转链接
NEWBIE_QA_LINK = "https://discord.com/channels/1446888252194816132/1447518124696928357"  # 新人提问频道链接

# 标注图片链接
PINNED_MESSAGE_GUIDE_URL = "https://raw.githubusercontent.com/CeciliaLeander/alien-pistachio-bot/main/pinned-message-guide.png"

# 规则消息跳转链接
RULES_LINK = "https://discord.com/channels/1446888252194816132/1447254631544520725/1472135687598903366"

Announcement_link = "https://discord.com/channels/1446888252194816132/1475021085484515381"

# 数据存储路径
DATA_DIR = "/data"
FILES_DIR = os.path.join(DATA_DIR, "files")
DB_PATH = os.path.join(DATA_DIR, "bot.db")

# 管理员身份组名称（拥有此身份组的人才能上传/验证）
ADMIN_ROLE_NAMES = ["开心果bot", "见习开心果bot"]

# ============ 匿名区配置 ============
# 冰雪甜品元素昵称池
ANON_NICKNAMES = [
    "🍦 冰淇淋泡芙", "🧁 雪域杯子蛋糕", "🍰 冰山芝士蛋糕", "❄️ 雪花马卡龙",
    "🍨 冰雪圣代", "🧊 冰晶棉花糖", "🍧 雪融刨冰", "🎂 霜糖蛋糕卷",
    "🍩 雪顶甜甜圈", "🍪 冰霜曲奇", "🧇 雪花华夫饼", "🍮 冰镇布丁",
    "🍡 雪见团子", "🥧 冰雪派", "🍬 霜糖奶糖", "🫧 冰泡芙",
    "🌨️ 雪绒提拉米苏", "☃️ 雪人慕斯", "🏔️ 冰峰千层", "💎 水晶果冻",
    "🌙 月光雪糕", "⛄ 雪球麻薯", "🎀 冰丝可丽饼", "🦢 天鹅泡芙",
    "🐧 企鹅冰棒", "🐻‍❄️ 北极熊奶昔", "🦊 雪狐蛋挞", "🐰 雪兔大福",
    "🌸 樱雪铜锣烧", "🍓 冰莓舒芙蕾", "🫐 蓝莓雪冰", "🍑 蜜桃冰沙",
    "🥝 雪梨奶冻", "🍋 柠檬冰霜", "🍇 葡萄雪泥", "🥥 椰雪冰糕",
    "🌈 彩虹冰棍", "✨ 星光雪饼", "🔮 水晶汤圆", "🪄 魔法雪糕",
    "🎪 梦幻冰塔", "🎠 旋转冰淇淋", "🎡 摩天轮雪顶", "🏰 冰雪城堡蛋糕",
    "🌊 海盐冰淇淋", "🧸 棉花糖小熊", "🎵 奏鸣曲雪糕", "🦋 蝴蝶酥冰淇淋",
    "🌻 向日葵冰饼", "🍂 枫糖雪球", "💫 流星冰沙", "🪷 雪莲慕斯",
    "🎐 风铃冰棒", "🏮 灯笼冰粉", "🎋 竹叶雪糕", "🌿 薄荷冰淇淋",
    "🍵 抹茶冰雪", "☕ 拿铁冰霜", "🥛 奶雪冰砖", "🧋 珍珠冰沙",
    "🫖 雪融奶茶", "🍶 清酒冰糕", "🥂 气泡冰酒", "🍹 冰雪鸡尾酒",
]

# 匿名昵称自动刷新间隔（小时）
ANON_REFRESH_HOURS = 24

def emoji_to_twemoji_url(emoji_char: str) -> str:
    """将 emoji 字符转换为 Twemoji CDN 图片 URL"""
    # 提取 emoji 的 Unicode 码点，转为 Twemoji 的文件名格式
    codepoints = []
    for char in emoji_char:
        cp = ord(char)
        if cp == 0xFE0F:  # 跳过变体选择符
            continue
        codepoints.append(f"{cp:x}")
    filename = "-".join(codepoints)
    return f"https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/{filename}.png"

def get_nickname_avatar_url(nickname: str) -> str:
    """从昵称中提取 emoji 并返回对应的头像 URL"""
    # 昵称格式为 "🍦 冰淇淋泡芙"，取第一个字符（emoji）
    if nickname:
        # 处理复合 emoji（如 🐻‍❄️），取空格前的部分
        emoji_part = nickname.split(" ")[0] if " " in nickname else nickname[0]
        return emoji_to_twemoji_url(emoji_part)
    return "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f9ca.png"  # 默认冰块

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
    # 匿名频道配置表
    c.execute('''CREATE TABLE IF NOT EXISTS anon_channels (
        guild_id INTEGER NOT NULL,
        channel_id INTEGER NOT NULL,
        set_by INTEGER NOT NULL,
        set_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, channel_id)
    )''')
    # 匿名身份映射表（同一用户在同一频道保持同一昵称）
    c.execute('''CREATE TABLE IF NOT EXISTS anon_identities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        channel_id INTEGER NOT NULL,
        nickname TEXT NOT NULL,
        assigned_at TEXT NOT NULL,
        UNIQUE(user_id, channel_id)
    )''')
    # 匿名消息记录表
    c.execute('''CREATE TABLE IF NOT EXISTS anon_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_message_id INTEGER NOT NULL,
        channel_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        nickname TEXT NOT NULL,
        content TEXT,
        sent_at TEXT NOT NULL
    )''')
    # 抽奖表
    c.execute('''CREATE TABLE IF NOT EXISTS lotteries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        channel_id INTEGER NOT NULL,
        message_id INTEGER,
        title TEXT NOT NULL,
        prize TEXT NOT NULL,
        winner_count INTEGER NOT NULL DEFAULT 1,
        required_role_id INTEGER,
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        end_time TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        ended_at TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS lottery_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lottery_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        entered_at TEXT NOT NULL,
        UNIQUE(lottery_id, user_id),
        FOREIGN KEY (lottery_id) REFERENCES lotteries(id)
    )''')

    # ========== 订阅面板持久化表 ==========
    c.execute('''CREATE TABLE IF NOT EXISTS subscribe_panels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL UNIQUE,
        channel_id INTEGER NOT NULL,
        guild_id INTEGER NOT NULL,
        role_ids TEXT NOT NULL,
        created_at TEXT NOT NULL
    )''')
    
    # ========== 临时身份组表 ==========
    c.execute('''CREATE TABLE IF NOT EXISTS temp_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        granted_by INTEGER NOT NULL,
        granted_at TEXT NOT NULL,
        expire_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        UNIQUE(guild_id, user_id, role_id)
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
    return any(role.name in ADMIN_ROLE_NAMES for role in interaction.user.roles)

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
    """在图片像素最低位嵌入追踪码，保留PNG元数据"""
    img = Image.open(io.BytesIO(image_bytes))
    original_format = img.format
    original_mode = img.mode
    
    # 保留PNG元数据
    png_info = img.info if original_format == "PNG" else {}
    
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
    if original_mode == "RGBA":
        new_img = new_img.convert("RGBA")

    if original_format == "JPEG":
        new_img.save(output, format="JPEG", quality=95)
    else:
        # 保留PNG的text chunks元数据
        from PIL import PngImagePlugin
        png_meta = PngImagePlugin.PngInfo()
        for key, value in png_info.items():
            if isinstance(value, str):
                png_meta.add_text(key, value)
            elif isinstance(value, bytes):
                png_meta.add_text(key, value.decode('latin-1'))
        new_img.save(output, format="PNG", pnginfo=png_meta)

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

# --- JSON 水印（extensions字段） ---

def embed_json_watermark(json_bytes, tracking_code):
    """在 JSON 文件的 extensions 字段中嵌入追踪码"""
    content = json_bytes.decode('utf-8')
    data = json.loads(content)

    # 在 extensions 字段中存入追踪码（符合角色卡V3规范）
    if 'data' in data and isinstance(data['data'], dict):
        if 'extensions' not in data['data'] or not isinstance(data['data'].get('extensions'), dict):
            data['data']['extensions'] = {}
        data['data']['extensions']['tracking_id'] = tracking_code
    else:
        if 'extensions' not in data or not isinstance(data.get('extensions'), dict):
            data['extensions'] = {}
        data['extensions']['tracking_id'] = tracking_code

    return json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')

def extract_json_watermark(json_bytes):
    """从 JSON 文件的 extensions 字段中提取追踪码"""
    content = json_bytes.decode('utf-8')
    data = json.loads(content)

    # 从 data.extensions 提取
    if 'data' in data and isinstance(data['data'], dict):
        ext = data['data'].get('extensions', {})
        if isinstance(ext, dict) and 'tracking_id' in ext:
            return ext['tracking_id']

    # 从顶层 extensions 提取
    ext = data.get('extensions', {})
    if isinstance(ext, dict) and 'tracking_id' in ext:
        return ext['tracking_id']

    return None

# ============ 抽奖工具函数 ============
def parse_duration(duration_str: str) -> timedelta | None:
    if not duration_str:
        return None
    total_seconds = 0
    pattern = re.findall(r'(\d+)\s*([dhm])', duration_str.lower())
    if not pattern:
        return None
    for value, unit in pattern:
        value = int(value)
        if unit == 'd':
            total_seconds += value * 86400
        elif unit == 'h':
            total_seconds += value * 3600
        elif unit == 'm':
            total_seconds += value * 60
    return timedelta(seconds=total_seconds) if total_seconds > 0 else None

async def do_lottery_draw(bot_instance, lottery_id: int):
    """执行抽奖开奖（定时和手动共用）"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT guild_id, channel_id, message_id, title, prize, winner_count, required_role_id, created_by FROM lotteries WHERE id = ? AND status = 'active'", (lottery_id,))
    lottery = c.fetchone()
    if not lottery:
        conn.close()
        return None
    guild_id, channel_id, message_id, title, prize, winner_count, required_role_id, created_by = lottery
    c.execute("SELECT user_id FROM lottery_entries WHERE lottery_id = ?", (lottery_id,))
    entries = [row[0] for row in c.fetchall()]
    c.execute("UPDATE lotteries SET status = 'ended', ended_at = ? WHERE id = ?", (datetime.now().isoformat(), lottery_id))
    conn.commit()
    conn.close()

    if not entries:
        winners = []
    elif len(entries) <= winner_count:
        winners = entries
    else:
        winners = random.sample(entries, winner_count)

    channel = bot_instance.get_channel(channel_id)
    if not channel:
        try:
            channel = await bot_instance.fetch_channel(channel_id)
        except Exception:
            return winners

    if winners:
        winner_mentions = ", ".join([f"<@{uid}>" for uid in winners])
        result_embed = discord.Embed(
            title="🎊 开奖啦开奖啦！",
            description=f"**{title}**\n\n🎁 奖品：**{prize}**\n👥 参与人数：{len(entries)}\n🏆 中奖者：{winner_mentions}\n\n恭喜恭喜！🎉🎉🎉",
            color=0xffd700
        )
    else:
        result_embed = discord.Embed(
            title="🎊 开奖啦…但是…",
            description=f"**{title}**\n\n🎁 奖品：**{prize}**\n👥 参与人数：0\n\n没有人参加呀…鹅好孤单 🥲",
            color=0x888888
        )
    await channel.send(embed=result_embed)

    if message_id:
        try:
            original_msg = await channel.fetch_message(message_id)
            ended_embed = original_msg.embeds[0] if original_msg.embeds else discord.Embed()
            ended_embed.color = 0x888888
            ended_embed.set_footer(text="🔒 抽奖已结束")
            await original_msg.edit(embed=ended_embed, view=None)
        except Exception:
            pass

    for uid in winners:
        try:
            user = await bot_instance.fetch_user(uid)
            dm_embed = discord.Embed(
                title="🎉 恭喜你中奖啦！",
                description=f"你在抽奖 **{title}** 中被幸运选中了！\n\n🎁 奖品：**{prize}**\n📍 来自频道：<#{channel_id}>\n\n请联系管理员领取奖品哦～🐾",
                color=0xffd700
            )
            await user.send(embed=dm_embed)
        except Exception:
            pass
    return winners

async def _lottery_timer(bot_instance, lottery_id: int, delay_seconds: float):
    await asyncio.sleep(delay_seconds)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT status FROM lotteries WHERE id = ?", (lottery_id,))
    result = c.fetchone()
    conn.close()
    if result and result[0] == 'active':
        await do_lottery_draw(bot_instance, lottery_id)

# ============ 抽奖按钮 View ============
class LotteryJoinView(discord.ui.View):
    def __init__(self, lottery_id: int, required_role_id: int | None = None):
        super().__init__(timeout=None)
        self.lottery_id = lottery_id
        self.required_role_id = required_role_id

    @discord.ui.button(label="🎰 参加抽奖！", style=discord.ButtonStyle.success, custom_id="lottery_join")
    async def join_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        user = interaction.user
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT status, required_role_id FROM lotteries WHERE id = ?", (self.lottery_id,))
        result = c.fetchone()
        if not result or result[0] != 'active':
            conn.close()
            await interaction.response.send_message("👂 这个抽奖已经结束啦～下次早点来哦", ephemeral=True)
            return
        req_role_id = result[1]
        if req_role_id:
            member = interaction.guild.get_member(user.id)
            if member and not any(r.id == req_role_id for r in member.roles):
                role = interaction.guild.get_role(req_role_id)
                role_name = role.name if role else "指定身份组"
                conn.close()
                await interaction.response.send_message(f"👂 需要拥有 **{role_name}** 身份组才能参加哦～", ephemeral=True)
                return
        try:
            c.execute("INSERT INTO lottery_entries (lottery_id, user_id, entered_at) VALUES (?, ?, ?)",
                      (self.lottery_id, user.id, datetime.now().isoformat()))
            conn.commit()
            c.execute("SELECT COUNT(*) FROM lottery_entries WHERE lottery_id = ?", (self.lottery_id,))
            count = c.fetchone()[0]
            conn.close()
            await interaction.response.send_message(f"🎉 报名成功！你是第 **{count}** 位参与者～祝你好运！🍀", ephemeral=True)
        except sqlite3.IntegrityError:
            conn.close()
            await interaction.response.send_message("👂 你已经报名过啦～不用重复参加哦", ephemeral=True)
        except Exception as e:
            conn.close()
            await interaction.response.send_message(f"👂 报名出了点问题：{str(e)}", ephemeral=True)

# ============ 持久化 View（Bot重启后按钮仍可用） ============
class PersistentLotteryView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="🎰 参加抽奖！", style=discord.ButtonStyle.success, custom_id="lottery_join")
    async def join_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT id, status, required_role_id FROM lotteries WHERE message_id = ?", (interaction.message.id,))
        result = c.fetchone()
        conn.close()
        if not result:
            await interaction.response.send_message("👂 找不到这个抽奖了…", ephemeral=True)
            return
        lottery_id, status, req_role_id = result
        if status != 'active':
            await interaction.response.send_message("👂 这个抽奖已经结束啦～下次早点来哦", ephemeral=True)
            return
        if req_role_id:
            member = interaction.guild.get_member(interaction.user.id)
            if member and not any(r.id == req_role_id for r in member.roles):
                role = interaction.guild.get_role(req_role_id)
                role_name = role.name if role else "指定身份组"
                await interaction.response.send_message(f"👂 需要拥有 **{role_name}** 身份组才能参加哦～", ephemeral=True)
                return
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        try:
            c.execute("INSERT INTO lottery_entries (lottery_id, user_id, entered_at) VALUES (?, ?, ?)",
                      (lottery_id, interaction.user.id, datetime.now().isoformat()))
            conn.commit()
            c.execute("SELECT COUNT(*) FROM lottery_entries WHERE lottery_id = ?", (lottery_id,))
            count = c.fetchone()[0]
            conn.close()
            await interaction.response.send_message(f"🎉 报名成功！你是第 **{count}** 位参与者～祝你好运！🍀", ephemeral=True)
        except sqlite3.IntegrityError:
            conn.close()
            await interaction.response.send_message("👂 你已经报名过啦～不用重复参加哦", ephemeral=True)
    
# ============ Bot 启动事件 ============
@bot.event
async def on_ready():
    bot.add_view(PersistentLotteryView())
    guild = discord.Object(id=GUILD_ID)
    bot.tree.copy_global_to(guild=guild)
    await bot.tree.sync(guild=guild)
    
    if not refresh_anon_nicknames.is_running():
        refresh_anon_nicknames.start()

    # ========== 恢复未结束的定时抽奖 ==========
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, end_time FROM lotteries WHERE status = 'active' AND end_time IS NOT NULL")
    pending = c.fetchall()
    conn.close()
    for lottery_id, end_time_str in pending:
        try:
            end_dt = datetime.fromisoformat(end_time_str)
            remaining = (end_dt - datetime.now()).total_seconds()
            if remaining <= 0:
                asyncio.create_task(do_lottery_draw(bot, lottery_id))
            else:
                asyncio.create_task(_lottery_timer(bot, lottery_id, remaining))
        except Exception as e:
            print(f"[抽奖恢复] 恢复抽奖 #{lottery_id} 失败：{e}")
    if pending:
        print(f"[抽奖恢复] 已恢复 {len(pending)} 个定时抽奖")

    # ========== 恢复订阅面板 ==========
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT message_id, channel_id, guild_id, role_ids FROM subscribe_panels")
    panels = c.fetchall()
    conn.close()
    for msg_id, ch_id, g_id, role_ids_json in panels:
        try:
            role_ids = json.loads(role_ids_json)
            guild_obj = bot.get_guild(g_id)
            if not guild_obj:
                continue
            roles = [guild_obj.get_role(rid) for rid in role_ids]
            roles = [r for r in roles if r is not None]
            if roles:
                view = build_persistent_subscribe_view(roles)
                bot.add_view(view, message_id=msg_id)
        except Exception as e:
            print(f"[订阅面板恢复] 恢复面板 {msg_id} 失败：{e}")
    if panels:
        print(f"[订阅面板恢复] 已恢复 {len(panels)} 个订阅面板")

    # ========== 恢复临时身份组定时器 ==========
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, guild_id, user_id, role_id, expire_at FROM temp_roles WHERE status = 'active'")
    temp_entries = c.fetchall()
    conn.close()
    for tr_id, g_id, u_id, r_id, expire_at_str in temp_entries:
        try:
            expire_dt = datetime.fromisoformat(expire_at_str)
            remaining = (expire_dt - datetime.now()).total_seconds()
            if remaining <= 0:
                asyncio.create_task(_remove_temp_role(bot, tr_id))
            else:
                asyncio.create_task(_temp_role_timer(bot, tr_id, remaining))
        except Exception as e:
            print(f"[临时身份组恢复] 恢复 #{tr_id} 失败：{e}")
    if temp_entries:
        print(f"[临时身份组恢复] 已恢复 {len(temp_entries)} 个临时身份组")

    print(f"👂 小鹅子上线了：{bot.user}")
    print(f"👂 已连接雪山：{[g.name for g in bot.guilds]}")

# ============ 新成员欢迎（私信） ============
@bot.event
async def on_member_join(member):
    welcome_text = (
        f"👂 哇！{member.name} 来啦来啦！\n"
        "小鹅子在这里！鹅是一只外星企鹅留在开心果雪山的进食器官～虽然没有眼睛也没有大脑，但是会努力当好管家的！\n\n"
        "**新朋友看这里呀：**\n"
        f"1. 【务必观看】雪山的社区规范在这里哦：{RULES_LINK} 。社区公告在这里哦：社区内重要和有趣的社区事情在这里播报：{Announcement_link}\n"
        "2. 看完能接受的话并且!!不是!!lc或wbz的成员，可以去新人提问区@【发卡组】或名称含有「新人bot」相关的老师礼貌申请卡区身份组：可颂🥐。在另外两个社区的宝宝直接去那两个社区拿卡即可。\n"
        "3. 记得善用频道标注功能哦，有标注的都是重要消息！\n"
        f"4. 有问题来这里问就好啦：{NEWBIE_QA_LINK}\n\n"
        "希望你在雪山玩得开心呀！鹅会乖乖看好仓库的～🐾"
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
        "👂 **小鹅子使用说明书**～鹅虽然没有大脑，但是功能很多的哦！\n\n"
        "📖 **大家都能用的：**\n"
        "`!帮助` - 就是你现在看到的这个啦～\n"
        "`!规则` - 雪山生存守则\n"
        "`/回顶` - 嗖地帮你飞到频道最顶上\n"
        "`/获取附件` - 从鹅的仓库里拿文件（要先点赞或评论哦）\n"
        "`/匿名发言` - 在匿名频道里偷偷说话～\n"
        "`/刷新匿名昵称` - 重新洗牌所有匿名昵称\n"
        "`/查看抽奖` - 看看有什么抽奖活动\n\n"
        "🔔 **角色订阅：**\n"
        "通过订阅面板自助选择喜欢的角色身份组，有新卡发布时就会收到通知哦～\n\n"
        "🔧 **管理员专属：**\n"
        "`/上传附件` - 往仓库里放文件\n"
        "`/更新附件` - 给文件换个新版本\n"
        "`/验证水印` - 用水印追踪泄露者\n"
        "`/查看记录` - 看看谁拿了什么文件\n"
        "`/删除附件` - 从仓库删掉文件\n"
        "`/设置匿名频道` - 开一个匿名区\n"
        "`/取消匿名频道` - 关掉匿名区\n"
        "`/查看匿名身份` - 看看匿名的人是谁\n"
        "`/发送订阅面板` - 发送角色身份组选择面板\n"
        "`/创建抽奖` - 发起一个抽奖活动\n"
        "`/手动开奖` - 立即结束抽奖并开奖\n"
        "`/取消抽奖` - 取消进行中的抽奖\n"
        "`/批量删除` - 批量删除频道消息\n"
	"`/发放临时身份组` - 给成员发放有时限的身份组\n"
        "`/临时身份组列表` - 查看/管理所有临时身份组\\n"
    )
    await ctx.send(help_text)

@bot.command(name="规则")
async def rules_command(ctx):
    """查看社区规范"""
    rules_text = (
        "👂 **雪山生存守则**～鹅来念给你听！\n\n"
        f"1. 规矩和板块介绍都在这里哦：{RULES_LINK}\n"
        "2. 看完觉得OK的话，若您不是lc或wbz成员，"
        "可以去新人提问区@【发卡组】或名称为「新人bot相关」的老师礼貌申请卡区身份组：可颂🥐\n"
        "3. 善用频道标注功能呀！有标注的都是重要消息哦～\n"
        f"4. 有问题来这里问就好啦：{NEWBIE_QA_LINK}\n\n"
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
        await interaction.response.send_message(f"👂 嗖～鹅帮你飞到最上面啦：{link}", ephemeral=True)
    else:
        await interaction.response.send_message("👂 这个频道还没有消息呢～空空的...", ephemeral=True)

# ============ 管理员：bot代发公告 ============
@bot.command(name="公告")
async def post_announcement(ctx):
    if not any(role.name in ADMIN_ROLE_NAMES for role in ctx.author.roles):
        await ctx.send("👂 这个只有管理员才能用哦～鹅也没办法呀")
        return

    # 获取 !公告 后面的所有文字
    content = ctx.message.content[len("!公告"):].strip()
    if not content:
        await ctx.send("👂 要在 `!公告` 后面写上内容哦～鹅猜不到你想说什么呀")
        return

    await ctx.message.delete()  # 删除管理员发的指令消息
    await ctx.send(content)  # Bot 发布内容
    
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
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
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
        await interaction.followup.send(f"👂 链接好像不对呀…鹅打不开这扇门\n错误信息：{str(e)}", ephemeral=True)
        return

    # 确定文件类型
    if 文件.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        file_type = "image"
    elif 文件.filename.lower().endswith('.json'):
        file_type = "json"
    else:
        file_type = "other"

    # 创建存储目录（名称过长时用帖子ID）
    folder_name = post_name if len(post_name.encode('utf-8')) <= 100 else str(thread_id)
    post_dir = os.path.join(FILES_DIR, folder_name)
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
            f"👂 塞进仓库了！\n"
            f"📁 帖子：{post_name}\n"
            f"📄 文件：{文件名}\n"
            f"🏷️ 版本：{版本}\n"
            f"📦 类型：{file_type}",
            ephemeral=True
        )
    except sqlite3.IntegrityError:
        await interaction.followup.send(f"👂 这个帖子下已经有同名同版本的文件啦：{文件名} {版本}", ephemeral=True)
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
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)

    # 从链接解析帖子ID
    try:
        parts = 帖子链接.strip().split('/')
        thread_id = int(parts[-1])
        thread = bot.get_channel(thread_id) or await bot.fetch_channel(thread_id)
        post_name = thread.name
    except Exception:
        await interaction.followup.send("👂 链接好像不对哦～右键帖子→复制链接，再给鹅看看吧", ephemeral=True)
        return

    # 确定文件类型
    if 文件.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        file_type = "image"
    elif 文件.filename.lower().endswith('.json'):
        file_type = "json"
    else:
        file_type = "other"

    # 保存文件（名称过长时用帖子ID）
    folder_name = post_name if len(post_name.encode('utf-8')) <= 100 else str(thread_id)
    post_dir = os.path.join(FILES_DIR, folder_name)
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
            f"👂 更新好了！\n"
            f"📁 帖子：{post_name}\n"
            f"📄 文件：{文件名}\n"
            f"🏷️ 新版本：{新版本}",
            ephemeral=True
        )
    except sqlite3.IntegrityError:
        await interaction.followup.send(f"👂 版本 {新版本} 已经存在了，换个版本号吧！", ephemeral=True)
    finally:
        conn.close()

# ============ 管理员：删除附件 ============
@bot.tree.command(name="删除附件", description="【管理员】删除指定帖子下的某个文件版本")
@app_commands.describe(帖子链接="帖子的链接（右键帖子→复制链接）")
async def delete_file(interaction: discord.Interaction, 帖子链接: str):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
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
        await interaction.followup.send(f"👂 链接好像不对呀…鹅打不开这扇门\n错误信息：{str(e)}", ephemeral=True)
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
        await interaction.followup.send(f"👂 帖子「{post_name}」下面还没有文件呢～", ephemeral=True)
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
            self.select = discord.ui.Select(placeholder="要删掉哪个呀？选一个吧...", options=options)
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
                await select_interaction.followup.send("👂 文件不见了…鹅找不到呀", ephemeral=True)
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
                f"👂 扔掉了！\n"
                f"📄 {fname} ({ver})",
                ephemeral=True
            )

    await interaction.followup.send(
        f"👂 帖子「{post_name}」下的文件，要扔哪个？",
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
            title="👂 走错啦走错啦！",
            description="要在帖子里面才能用这个指令哦～鹅的仓库门开在帖子里面呢！",
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
            title="👂 等一下等一下！",
            description="要先给帖子首楼**点个赞** ⭐ 或者**留条评论** 💬 才能拿附件哦～\n\n这是雪山的小小规矩，拜托啦！",
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
            title="👂 仓库里空空的呀",
            description="这个帖子还没有附件呢～等管理员放进来就好啦！",
            color=0x888888
        )
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    # 创建文件选择菜单
    class FileSelectView(discord.ui.View):
        def __init__(self):
            super().__init__(timeout=60)
            options = [discord.SelectOption(label=name, value=name) for name in file_names]
            self.select = discord.ui.Select(placeholder="👂 想要啥？选一个吧...", options=options)
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
                    self.select = discord.ui.Select(placeholder="👂 要哪个版本？", options=options)
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
                        await version_interaction.followup.send("👂 文件不见了…鹅找不到呀", ephemeral=True)
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
                            original_ext = os.path.splitext(file_path)[1].lower()
                            ext = original_ext if original_ext in ('.png', '.jpg', '.jpeg') else '.png'
                        elif file_type == "json":
                            watermarked_bytes = embed_json_watermark(file_bytes, tracking_code)
                            ext = ".json"
                        else:
                            watermarked_bytes = file_bytes
                            ext = os.path.splitext(file_path)[1]
                    except Exception as e:
                        await version_interaction.followup.send(f"👂 水印没打上去：{str(e)}", ephemeral=True)
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
                        title="👂 给你给你～拿好哦！",
                        description=(
                            f"📄 **{selected_file}** ({selected_version})\n\n"
                            "🔒 鹅已经在上面做了小小的记号～\n"
                            "要好好保管，不要到处传哦🐾"
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
        title="👂 欢迎来到鹅的小仓库！",
        description="想要什么文件呀？选一个吧～",
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
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
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
        await interaction.followup.send("👂 鹅闻了闻…没有闻到水印的味道呢，可能不是从这里发出去的，或者水印被弄坏了", ephemeral=True)
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
            f"👂 **鹅找到啦！水印验证结果：**\n\n"
            f"🔑 追踪码：`{tracking_code}`\n"
            f"👤 用户：{user_name}（ID: {user_id}）\n"
            f"📁 帖子：{post_name}\n"
            f"📄 文件：{file_name} ({version})\n"
            f"🕐 获取时间：{retrieved_at}",
            ephemeral=True
        )
    else:
        await interaction.followup.send(
            f"🔑 追踪码：`{tracking_code}`\n👂 鹅翻了翻，没有找到对应的记录呢…",
            ephemeral=True
        )
        
# ============ 管理员：查看追踪记录 ============
@bot.tree.command(name="查看记录", description="【管理员】查看某个帖子的所有文件获取记录")
@app_commands.describe(帖子名称="要查看的帖子名称")
async def view_tracking(interaction: discord.Interaction, 帖子名称: str):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
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
        await interaction.response.send_message(f"👂 帖子「{帖子名称}」还没有人来拿过呢～", ephemeral=True)
        return

    text = f"👂 **帖子「{帖子名称}」的取件记录（最近20条）：**\n\n"
    for code, user_name, file_name, version, retrieved_at in records:
        text += f"`{code}` | {user_name} | {file_name} ({version}) | {retrieved_at}\n"

    await interaction.response.send_message(text, ephemeral=True)

# ============ 匿名区功能 ============

def get_or_assign_nickname(user_id: int, channel_id: int) -> str:
    """获取用户在某频道的当前轮次匿名昵称，如果没有则分配一个新的"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 先查是否已有昵称
    c.execute("SELECT nickname FROM anon_identities WHERE user_id = ? AND channel_id = ?", (user_id, channel_id))
    result = c.fetchone()
    if result:
        conn.close()
        return result[0]
    
    # 查询该频道已使用的昵称
    c.execute("SELECT nickname FROM anon_identities WHERE channel_id = ?", (channel_id,))
    used_nicknames = {row[0] for row in c.fetchall()}
    
    # 从昵称池中选一个未使用的
    available = [n for n in ANON_NICKNAMES if n not in used_nicknames]
    if not available:
        # 如果昵称池用完了，加上数字后缀
        nickname = random.choice(ANON_NICKNAMES) + f"·{random.randint(100, 999)}"
    else:
        nickname = random.choice(available)
    
    # 存入数据库
    c.execute(
        "INSERT INTO anon_identities (user_id, channel_id, nickname, assigned_at) VALUES (?, ?, ?, ?)",
        (user_id, channel_id, nickname, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()
    return nickname

def is_anon_channel(guild_id: int, channel_id: int) -> bool:
    """检查频道是否为匿名频道"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT 1 FROM anon_channels WHERE guild_id = ? AND channel_id = ?", (guild_id, channel_id))
    result = c.fetchone()
    conn.close()
    return result is not None

# ---- 定时刷新匿名昵称 ----
@tasks.loop(hours=ANON_REFRESH_HOURS)
async def refresh_anon_nicknames():
    """定期清空所有匿名身份映射，下次发言时会重新分配新昵称"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    deleted = c.execute("DELETE FROM anon_identities").rowcount
    conn.commit()
    conn.close()
    print(f"[匿名刷新] 已清空 {deleted} 条匿名身份映射，所有昵称将在下次发言时重新分配")
    
    # 向所有匿名频道发送刷新通知
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT channel_id FROM anon_channels")
    channel_ids = [row[0] for row in c.fetchall()]
    conn.close()
    
    for ch_id in channel_ids:
        try:
            channel = bot.get_channel(ch_id)
            if channel:
                embed = discord.Embed(
                    title="🔄 洗牌时间到啦！",
                    description=(
                        "所有人的匿名代号都重新分配啦～\n"
                        "下次 `/匿名发言` 会拿到全新的甜品身份哦！猜猜你会变成什么呀？🍦"
                    ),
                    color=0x88ccff
                )
                await channel.send(embed=embed)
        except Exception:
            pass

@refresh_anon_nicknames.before_loop
async def before_refresh():
    """等待 Bot 准备就绪后再开始定时任务"""
    await bot.wait_until_ready()

# ---- 管理员：设置匿名频道 ----
@bot.tree.command(name="设置匿名频道", description="【管理员】将当前频道设为匿名发言区")
async def set_anon_channel(interaction: discord.Interaction):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
        return
    
    guild_id = interaction.guild_id
    channel_id = interaction.channel_id
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute(
            "INSERT OR REPLACE INTO anon_channels (guild_id, channel_id, set_by, set_at) VALUES (?, ?, ?, ?)",
            (guild_id, channel_id, interaction.user.id, datetime.now().isoformat())
        )
        conn.commit()
        embed = discord.Embed(
            title="🎭 匿名区开张啦！",
            description=(
                f"鹅宣布～这里现在是匿名发言区！\n\n"
                f"**两种匿名方式：**\n"
                f"💬 **直接打字** — 鹅会自动删掉原消息并匿名重发（有极短延迟，可能被瞥到）\n"
                f"🔒 **用 `/匿名发言`** — 完全隐藏身份，但需要每次用指令\n\n"
                f"🍦 每个人都会分到一个冰雪甜品代号～\n"
                f"🔄 代号每 {ANON_REFRESH_HOURS} 小时自动洗牌一次\n"
                f"⚠️ 管理员可通过 `/查看匿名身份` 查看真实身份哦"
            ),
            color=0x88ccff
        )
        await interaction.response.send_message(embed=embed)
    except Exception as e:
        await interaction.response.send_message(f"❌ 设置失败：{str(e)}", ephemeral=True)
    finally:
        conn.close()

# ---- 管理员：取消匿名频道 ----
@bot.tree.command(name="取消匿名频道", description="【管理员】取消当前频道的匿名发言区设置")
async def unset_anon_channel(interaction: discord.Interaction):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
        return
    
    guild_id = interaction.guild_id
    channel_id = interaction.channel_id
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM anon_channels WHERE guild_id = ? AND channel_id = ?", (guild_id, channel_id))
    deleted = c.rowcount
    conn.commit()
    conn.close()
    
    if deleted:
        await interaction.response.send_message("👂 好的呀，匿名区关门啦～大家的秘密鹅会好好保管的", ephemeral=True)
    else:
        await interaction.response.send_message("👂 这里本来就不是匿名区呀～", ephemeral=True)

# ---- 全员：手动刷新匿名昵称 ----
@bot.tree.command(name="刷新匿名昵称", description="【管理员】立即刷新所有匿名频道的昵称分配")
async def manual_refresh_nicknames(interaction: discord.Interaction):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    deleted = c.execute("DELETE FROM anon_identities").rowcount
    conn.commit()
    conn.close()
    
    # 重置定时器，从现在开始重新计时
    refresh_anon_nicknames.restart()
    
    await interaction.response.send_message(
        f"👂 洗牌完毕～清掉了 {deleted} 个旧代号，下次发言就是新身份啦！\n"
        f"⏰ 下次自动洗牌在 {ANON_REFRESH_HOURS} 小时后哦",
        ephemeral=True
    )

# ---- 用户：匿名发言 ----
@bot.tree.command(name="匿名发言", description="在匿名频道中匿名发送消息")
@app_commands.describe(
    内容="要发送的文字内容（可选，如果只发附件可以留空）",
    图片="要发送的图片（可选）",
    附件="要发送的其他附件（可选）"
)
async def anon_speak(
    interaction: discord.Interaction,
    内容: str = None,
    图片: discord.Attachment = None,
    附件: discord.Attachment = None
):
    # 检查是否在匿名频道中
    channel = interaction.channel
    # 如果在帖子中，检查其父频道
    target_channel_id = channel.parent_id if isinstance(channel, discord.Thread) else channel.id
    guild_id = interaction.guild_id
    
    if not is_anon_channel(guild_id, target_channel_id) and not is_anon_channel(guild_id, channel.id):
        await interaction.response.send_message(
            "👂 这里不是匿名区哦～要去管理员设置好的匿名频道才能偷偷说话呀",
            ephemeral=True
        )
        return
    
    # 检查是否有内容
    if not 内容 and not 图片 and not 附件:
        await interaction.response.send_message("👂 要说点什么呀～文字、图片、附件，总得来一个嘛！", ephemeral=True)
        return
    
    await interaction.response.defer(ephemeral=True)
    
    # 获取/分配匿名昵称（当前轮次内保持一致）
    nickname = get_or_assign_nickname(interaction.user.id, channel.id)
    
    # 获取昵称对应的 emoji 头像 URL
    avatar_url = get_nickname_avatar_url(nickname)
    
    # 处理附件
    files = []
    if 图片:
        image_bytes = await 图片.read()
        files.append(discord.File(io.BytesIO(image_bytes), filename=图片.filename))
    if 附件:
        attachment_bytes = await 附件.read()
        files.append(discord.File(io.BytesIO(attachment_bytes), filename=附件.filename))
    
    # 通过 Webhook 发送匿名消息
    try:
        # 获取或创建频道的 Webhook
        # 如果是帖子，需要在父频道创建 Webhook，然后发送到帖子
        webhook_channel = channel.parent if isinstance(channel, discord.Thread) else channel
        
        # 查找已有的匿名 Webhook
        webhooks = await webhook_channel.webhooks()
        webhook = discord.utils.get(webhooks, name="小鹅子匿名")
        
        if not webhook:
            webhook = await webhook_channel.create_webhook(name="小鹅子匿名")
        
        # 发送参数
        send_kwargs = {
            "username": nickname,
            "avatar_url": avatar_url,
            "wait": True,  # 等待返回消息对象
        }
        
        if 内容:
            send_kwargs["content"] = 内容
        
        if files:
            send_kwargs["files"] = files
        
        # 如果在帖子中，需要指定 thread
        if isinstance(channel, discord.Thread):
            send_kwargs["thread"] = channel
        
        webhook_message = await webhook.send(**send_kwargs)
        
        # 记录到数据库（历史记录永久保留，不受刷新影响）
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "INSERT INTO anon_messages (bot_message_id, channel_id, user_id, nickname, content, sent_at) VALUES (?, ?, ?, ?, ?, ?)",
            (webhook_message.id, channel.id, interaction.user.id, nickname, 内容 or "", datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
        
        # 成功时静默回复，不打扰聊天
        await interaction.followup.send("✅", ephemeral=True)
    except Exception as e:
        await interaction.followup.send(f"👂 发送失败了：{str(e)}", ephemeral=True)

# ---- 自动匿名转发：匿名频道中直接打字自动变匿名 ----
@bot.event
async def on_message(message):
    # 忽略 Bot 自己的消息和 Webhook 消息
    if message.author.bot:
        await bot.process_commands(message)
        return
    
    # 判断是否在匿名频道中
    channel = message.channel
    guild = message.guild
    if not guild:
        await bot.process_commands(message)
        return
    
    # 检查当前频道或其父频道是否为匿名频道
    target_channel_id = channel.parent_id if isinstance(channel, discord.Thread) else channel.id
    
    if not is_anon_channel(guild.id, target_channel_id) and not is_anon_channel(guild.id, channel.id):
        await bot.process_commands(message)
        return
    
    # 如果是 ! 开头的指令，不做匿名转发，正常处理指令
    if message.content and message.content.startswith("!"):
        await bot.process_commands(message)
        return
    
    # 是匿名频道 → 自动转发
    try:
        # 获取/分配匿名昵称
        nickname = get_or_assign_nickname(message.author.id, channel.id)
        avatar_url = get_nickname_avatar_url(nickname)
        
        # 处理附件
        files = []
        for attachment in message.attachments:
            file_bytes = await attachment.read()
            files.append(discord.File(io.BytesIO(file_bytes), filename=attachment.filename))
        
        # 删除原消息
        try:
            await message.delete()
        except Exception:
            pass
        
        # 获取或创建 Webhook
        webhook_channel = channel.parent if isinstance(channel, discord.Thread) else channel
        webhooks = await webhook_channel.webhooks()
        webhook = discord.utils.get(webhooks, name="小鹅子匿名")
        if not webhook:
            webhook = await webhook_channel.create_webhook(name="小鹅子匿名")
        
        # 发送参数
        send_kwargs = {
            "username": nickname,
            "avatar_url": avatar_url,
            "wait": True,
        }
        
        if message.content:
            send_kwargs["content"] = message.content
        
        if files:
            send_kwargs["files"] = files
        
        if isinstance(channel, discord.Thread):
            send_kwargs["thread"] = channel
        
        # 没有内容也没有附件就不发
        if not message.content and not files:
            await bot.process_commands(message)
            return
        
        webhook_message = await webhook.send(**send_kwargs)
        
        # 记录到数据库
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "INSERT INTO anon_messages (bot_message_id, channel_id, user_id, nickname, content, sent_at) VALUES (?, ?, ?, ?, ?, ?)",
            (webhook_message.id, channel.id, message.author.id, nickname, message.content or "", datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
        
    except Exception as e:
        # 转发失败时尝试提示用户
        try:
            hint = await channel.send(f"👂 匿名转发失败了…可以试试用 `/匿名发言` 指令哦", delete_after=5)
        except Exception:
            pass
    
    # 确保其他指令（如 !帮助）仍然能正常工作
    await bot.process_commands(message)

# ---- 管理员：查看匿名身份 ----
@bot.tree.command(name="查看匿名身份", description="【管理员】通过消息链接查看匿名者的真实身份")
@app_commands.describe(消息链接="匿名消息的链接（右键消息→复制消息链接）")
async def check_anon_identity(interaction: discord.Interaction, 消息链接: str):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
        return
    
    # 从链接解析消息ID
    try:
        parts = 消息链接.strip().split('/')
        message_id = int(parts[-1])
        channel_id = int(parts[-2])
    except (ValueError, IndexError):
        await interaction.response.send_message("👂 这个链接好像不太对呀～右键消息→复制消息链接，再试一次吧", ephemeral=True)
        return
    
    # 查询数据库（从永久保留的消息记录中查）
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT user_id, nickname, content, sent_at FROM anon_messages WHERE bot_message_id = ? AND channel_id = ?",
        (message_id, channel_id)
    )
    result = c.fetchone()
    conn.close()
    
    if not result:
        await interaction.response.send_message("👂 鹅翻了翻记录…这条好像不是匿名消息呢", ephemeral=True)
        return
    
    user_id, nickname, content, sent_at = result
    
    # 尝试获取用户信息
    try:
        user = await bot.fetch_user(user_id)
        user_display = f"{user.name}（{user.display_name}）"
    except Exception:
        user_display = f"未知用户"
    
    embed = discord.Embed(
        title="👂 鹅找到啦！",
        color=0xff9900
    )
    embed.add_field(name="🎭 匿名昵称", value=nickname, inline=False)
    embed.add_field(name="👤 真实用户", value=f"{user_display}\nID: `{user_id}`", inline=False)
    embed.add_field(name="💬 消息内容", value=content[:200] if content else "（无文字内容）", inline=False)
    embed.add_field(name="🕐 发送时间", value=sent_at, inline=False)
    
    await interaction.response.send_message(embed=embed, ephemeral=True)

# ============ 角色订阅功能（持久化版） ============

def build_persistent_subscribe_view(roles: list) -> discord.ui.View:
    """构建持久化的订阅面板 View，bot重启后仍可用"""
    view = discord.ui.View(timeout=None)
    chunks = [roles[i:i+25] for i in range(0, len(roles), 25)]
    
    for idx, chunk in enumerate(chunks):
        options = [
            discord.SelectOption(label=role.name, value=str(role.id))
            for role in chunk
        ]
        placeholder = "👂 选择你喜欢的角色吧～" if len(chunks) == 1 else f"👂 角色列表（{idx+1}/{len(chunks)}）"
        
        select = discord.ui.Select(
            placeholder=placeholder,
            min_values=0,
            max_values=len(options),
            options=options,
            custom_id=f"subscribe_select_{idx}",
        )
        
        chunk_role_ids = {r.id for r in chunk}
        
        def bind_callback(s, pids):
            async def cb(si: discord.Interaction):
                await si.response.defer(ephemeral=True)
                guild = si.guild
                member = si.user
                selected_ids = {int(v) for v in si.data["values"]}
                current_ids = {r.id for r in member.roles if r.id in pids}
                to_add = selected_ids - current_ids
                to_remove = current_ids - selected_ids
                added, removed, errors = [], [], []
                for rid in to_add:
                    role = guild.get_role(rid)
                    if role:
                        try:
                            await member.add_roles(role)
                            added.append(role.name)
                        except Exception:
                            errors.append(role.name)
                for rid in to_remove:
                    role = guild.get_role(rid)
                    if role:
                        try:
                            await member.remove_roles(role)
                            removed.append(role.name)
                        except Exception:
                            errors.append(role.name)
                lines = []
                if added:
                    lines.append(f"✅ 订阅了：**{'**、**'.join(added)}**")
                if removed:
                    lines.append(f"🔕 取消订阅了：**{'**、**'.join(removed)}**")
                if not added and not removed:
                    lines.append("没有变化哦～你的选择和之前一样")
                if errors:
                    lines.append(f"⚠️ 操作失败了：{'、'.join(errors)}（可能是鹅的权限不够呀）")
                await si.followup.send(f"👂 {chr(10).join(lines)}", ephemeral=True)
            s.callback = cb
        
        bind_callback(select, chunk_role_ids)
        view.add_item(select)
    
    return view

## 管理员发送身份组选择面板
@bot.tree.command(name="发送订阅面板", description="【管理员】发送角色身份组选择面板")
async def send_subscribe_panel(interaction: discord.Interaction):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
        return
    
    guild = interaction.guild
    available_roles = [
        r for r in sorted(guild.roles, key=lambda x: x.name)
        if not r.is_default()
        and not r.is_bot_managed()
        and not r.is_integration()
        and r.name not in ADMIN_ROLE_NAMES
        and not r.permissions.administrator
    ]
    
    if not available_roles:
        await interaction.response.send_message("👂 服务器里好像没有可选的身份组呢…", ephemeral=True)
        return
    
    admin_view = discord.ui.View(timeout=120)
    page_selections = {}
    chunks = [available_roles[i:i+25] for i in range(0, len(available_roles), 25)]
    
    for idx, chunk in enumerate(chunks):
        options = [
            discord.SelectOption(label=role.name, value=str(role.id))
            for role in chunk
        ]
        placeholder = "选择要放进面板的身份组～" if len(chunks) == 1 else f"身份组列表（{idx+1}/{len(chunks)}）"
        admin_select = discord.ui.Select(
            placeholder=placeholder, min_values=0, max_values=len(options), options=options,
        )
        
        def bind_admin_cb(s, page_idx):
            async def cb(si: discord.Interaction):
                page_selections[page_idx] = {int(v) for v in si.data["values"]}
                all_selected = set()
                for page_set in page_selections.values():
                    all_selected |= page_set
                names = [guild.get_role(rid).name for rid in all_selected if guild.get_role(rid)]
                names.sort()
                await si.response.send_message(
                    f"👂 目前已选 {len(names)} 个：{'、'.join(names) if names else '无'}\n"
                    f"继续选其他的，或者点 ✅ 确认发送吧～",
                    ephemeral=True
                )
            s.callback = cb
        bind_admin_cb(admin_select, idx)
        admin_view.add_item(admin_select)
    
    confirm_btn = discord.ui.Button(label="✅ 确认发送", style=discord.ButtonStyle.success)
    cancel_btn = discord.ui.Button(label="❌ 取消", style=discord.ButtonStyle.secondary)
    
    async def confirm_callback(btn_interaction: discord.Interaction):
        all_selected = set()
        for page_set in page_selections.values():
            all_selected |= page_set
        if not all_selected:
            await btn_interaction.response.send_message("👂 你还没选任何身份组呢～至少选一个吧", ephemeral=True)
            return
        chosen_roles = [guild.get_role(rid) for rid in all_selected]
        chosen_roles = [r for r in chosen_roles if r is not None]
        chosen_roles.sort(key=lambda r: r.name)
        if not chosen_roles:
            await btn_interaction.response.send_message("👂 选中的身份组好像都不存在了…", ephemeral=True)
            return
        
        role_list = "、".join([f"**{r.name}**" for r in chosen_roles])
        embed = discord.Embed(
            title="🔔 角色身份组选择",
            description=(
                f"这次包含的角色：{role_list}\n\n"
                "在下面选择你喜欢的角色吧～\n"
                "选中就会加入对应身份组，取消选中就会退出\n"
                "之后这个角色有新作品发布时你就能收到通知啦！🐾"
            ),
            color=0xffb6c1
        )
        embed.set_footer(text="👂 可以反复打开菜单修改选择哦～")
        
        view = build_persistent_subscribe_view(chosen_roles)
        
        try:
            await btn_interaction.message.delete()
        except Exception:
            pass
        
        panel_msg = await btn_interaction.channel.send(embed=embed, view=view)
        
        # 存入数据库，bot重启时恢复
        role_ids_json = json.dumps([r.id for r in chosen_roles])
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "INSERT INTO subscribe_panels (message_id, channel_id, guild_id, role_ids, created_at) VALUES (?, ?, ?, ?, ?)",
            (panel_msg.id, btn_interaction.channel_id, guild.id, role_ids_json, datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
        
        await btn_interaction.response.send_message("👂 订阅面板发送成功啦！", ephemeral=True)
        admin_view.stop()
    
    async def cancel_callback(btn_interaction: discord.Interaction):
        try:
            await btn_interaction.message.delete()
        except Exception:
            pass
        await btn_interaction.response.send_message("👂 好的，取消了～", ephemeral=True)
        admin_view.stop()
    
    confirm_btn.callback = confirm_callback
    cancel_btn.callback = cancel_callback
    admin_view.add_item(confirm_btn)
    admin_view.add_item(cancel_btn)
    
    admin_embed = discord.Embed(
        title="🔧 选择要放进订阅面板的身份组",
        description=(
            "从下面的菜单中选择角色身份组吧～\n"
            "可以从多个菜单里分别选，全部选好后点 **✅ 确认发送**\n\n"
            f"📋 共有 {len(available_roles)} 个可选身份组"
        ),
        color=0xffa500
    )
    admin_embed.set_footer(text="👂 只有你能看到这个面板哦～120秒后自动过期")
    await interaction.response.send_message(embed=admin_embed, view=admin_view, ephemeral=True)

# ============ 抽奖指令 ============
@bot.tree.command(name="创建抽奖", description="【管理员】在当前频道发起一个抽奖活动")
@app_commands.describe(标题="抽奖活动名称（如：新年福利抽奖）", 奖品="奖品描述（如：限定角色卡 x1）", 中奖人数="中奖名额（默认1人）", 时长="自动开奖倒计时，留空则需手动开奖（格式：30m / 2h / 1d / 1d2h30m）", 限定身份组="仅拥有该身份组的成员才能参与（可选）")
async def create_lottery(interaction: discord.Interaction, 标题: str, 奖品: str, 中奖人数: int = 1, 时长: str = None, 限定身份组: discord.Role = None):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
        return
    if 中奖人数 < 1:
        await interaction.response.send_message("👂 中奖人数至少要1个呀～", ephemeral=True)
        return
    await interaction.response.defer()
    end_time = None
    duration_delta = None
    if 时长:
        duration_delta = parse_duration(时长)
        if not duration_delta:
            await interaction.followup.send("👂 时长格式不对呀～例子：`30m`（30分钟）、`2h`（2小时）、`1d`（1天）、`1d2h30m`（1天2小时30分钟）", ephemeral=True)
            return
        end_time = datetime.now() + duration_delta
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO lotteries (guild_id, channel_id, title, prize, winner_count, required_role_id, created_by, created_at, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')",
        (interaction.guild_id, interaction.channel_id, 标题, 奖品, 中奖人数, 限定身份组.id if 限定身份组 else None, interaction.user.id, datetime.now().isoformat(), end_time.isoformat() if end_time else None))
    lottery_id = c.lastrowid
    conn.commit()
    conn.close()
    desc_lines = [f"🎁 **奖品：**{奖品}", f"🏆 **中奖名额：**{中奖人数} 人"]
    if 限定身份组:
        desc_lines.append(f"🔒 **参与条件：**需要 {限定身份组.mention} 身份组")
    if end_time:
        unix_ts = int(end_time.timestamp())
        desc_lines.append(f"⏰ **开奖时间：**<t:{unix_ts}:F>（<t:{unix_ts}:R>）")
    else:
        desc_lines.append("⏰ **开奖方式：**管理员手动开奖")
    desc_lines.append(f"\n🎯 **抽奖编号：**#{lottery_id}")
    desc_lines.append("\n👇 点击下方按钮参加抽奖吧！")
    embed = discord.Embed(title=f"🎰 {标题}", description="\n".join(desc_lines), color=0xff6b9d)
    embed.set_footer(text="👂 小鹅子祝大家好运～中奖会私信通知哦！")
    view = LotteryJoinView(lottery_id, 限定身份组.id if 限定身份组 else None)
    lottery_msg = await interaction.followup.send(embed=embed, view=view, wait=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE lotteries SET message_id = ? WHERE id = ?", (lottery_msg.id, lottery_id))
    conn.commit()
    conn.close()
    if duration_delta:
        asyncio.create_task(_lottery_timer(bot, lottery_id, duration_delta.total_seconds()))

@bot.tree.command(name="手动开奖", description="【管理员】立即结束指定抽奖并开奖")
@app_commands.describe(抽奖编号="抽奖活动编号（创建时显示的 #数字）")
async def manual_draw(interaction: discord.Interaction, 抽奖编号: int):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT status, title FROM lotteries WHERE id = ? AND guild_id = ?", (抽奖编号, interaction.guild_id))
    result = c.fetchone()
    conn.close()
    if not result:
        await interaction.followup.send("👂 找不到这个编号的抽奖呀～", ephemeral=True)
        return
    if result[0] != 'active':
        await interaction.followup.send(f"👂 抽奖「{result[1]}」已经结束过了哦～", ephemeral=True)
        return
    winners = await do_lottery_draw(bot, 抽奖编号)
    if winners is None:
        await interaction.followup.send("👂 开奖失败了…", ephemeral=True)
    elif winners:
        winner_names = ", ".join([f"<@{uid}>" for uid in winners])
        await interaction.followup.send(f"👂 开奖完成！中奖者：{winner_names}", ephemeral=True)
    else:
        await interaction.followup.send("👂 开奖了，但是没有人参加呢…", ephemeral=True)

@bot.tree.command(name="取消抽奖", description="【管理员】取消一个进行中的抽奖")
@app_commands.describe(抽奖编号="抽奖活动编号")
async def cancel_lottery(interaction: discord.Interaction, 抽奖编号: int):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
        return
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT status, title, channel_id, message_id FROM lotteries WHERE id = ? AND guild_id = ?", (抽奖编号, interaction.guild_id))
    result = c.fetchone()
    if not result:
        conn.close()
        await interaction.response.send_message("👂 找不到这个编号的抽奖呀～", ephemeral=True)
        return
    if result[0] != 'active':
        conn.close()
        await interaction.response.send_message(f"👂 抽奖「{result[1]}」已经结束了，不能取消哦～", ephemeral=True)
        return
    title, channel_id, message_id = result[1], result[2], result[3]
    c.execute("UPDATE lotteries SET status = 'cancelled', ended_at = ? WHERE id = ?", (datetime.now().isoformat(), 抽奖编号))
    conn.commit()
    conn.close()
    if message_id:
        try:
            channel = bot.get_channel(channel_id)
            if channel:
                msg = await channel.fetch_message(message_id)
                cancel_embed = discord.Embed(title=f"❌ {title}（已取消）", description="这个抽奖已被管理员取消了～", color=0xff4444)
                await msg.edit(embed=cancel_embed, view=None)
        except Exception:
            pass
    await interaction.response.send_message(f"👂 抽奖「{title}」已取消～", ephemeral=True)

@bot.tree.command(name="查看抽奖", description="查看当前服务器进行中的抽奖")
async def list_lotteries(interaction: discord.Interaction):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""SELECT l.id, l.title, l.prize, l.winner_count, l.end_time, l.channel_id,
                  (SELECT COUNT(*) FROM lottery_entries WHERE lottery_id = l.id) as entry_count
           FROM lotteries l WHERE l.guild_id = ? AND l.status = 'active' ORDER BY l.created_at DESC""", (interaction.guild_id,))
    lotteries = c.fetchall()
    conn.close()
    if not lotteries:
        await interaction.response.send_message("👂 目前没有进行中的抽奖哦～", ephemeral=True)
        return
    embed = discord.Embed(title="🎰 当前进行中的抽奖", color=0xff6b9d)
    for lid, title, prize, winner_count, end_time, channel_id, entry_count in lotteries:
        if end_time:
            try:
                end_dt = datetime.fromisoformat(end_time)
                unix_ts = int(end_dt.timestamp())
                time_info = f"⏰ <t:{unix_ts}:R>"
            except Exception:
                time_info = f"⏰ {end_time}"
        else:
            time_info = "⏰ 手动开奖"
        embed.add_field(name=f"#{lid} {title}", value=f"🎁 {prize} | 🏆 {winner_count}名 | 👥 {entry_count}人参与 | {time_info}\n📍 <#{channel_id}>", inline=False)
    await interaction.response.send_message(embed=embed, ephemeral=True)

# ============ 临时身份组功能 ============

def parse_expire_time(time_str: str):
    """解析到期时间，支持时长格式(30m/2h/7d)和日期格式(2025-03-01 12:00)"""
    if not time_str:
        return None
    delta = parse_duration(time_str)
    if delta:
        return datetime.now() + delta
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y/%m/%d %H:%M", "%Y/%m/%d"):
        try:
            return datetime.strptime(time_str.strip(), fmt)
        except ValueError:
            continue
    return None


async def _remove_temp_role(bot_instance, temp_role_id: int):
    """移除临时身份组"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT guild_id, user_id, role_id FROM temp_roles WHERE id = ? AND status = 'active'", (temp_role_id,))
    result = c.fetchone()
    if not result:
        conn.close()
        return
    guild_id, user_id, role_id = result
    c.execute("UPDATE temp_roles SET status = 'expired' WHERE id = ?", (temp_role_id,))
    conn.commit()
    conn.close()
    
    try:
        guild = bot_instance.get_guild(guild_id)
        if not guild:
            return
        member = guild.get_member(user_id)
        if not member:
            try:
                member = await guild.fetch_member(user_id)
            except Exception:
                return
        role = guild.get_role(role_id)
        if role and role in member.roles:
            await member.remove_roles(role, reason="临时身份组到期")
            try:
                dm_embed = discord.Embed(
                    title="⏰ 临时身份组到期啦",
                    description=(
                        f"你在 **{guild.name}** 的临时身份组 **{role.name}** 已到期，已自动移除～\n\n"
                        "如有需要可以联系管理员哦🐾"
                    ),
                    color=0xffaa00
                )
                await member.send(embed=dm_embed)
            except Exception:
                pass
    except Exception as e:
        print(f"[临时身份组] 移除 #{temp_role_id} 失败：{e}")


async def _temp_role_timer(bot_instance, temp_role_id: int, delay_seconds: float):
    """等待后自动移除临时身份组"""
    await asyncio.sleep(delay_seconds)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT status FROM temp_roles WHERE id = ?", (temp_role_id,))
    result = c.fetchone()
    conn.close()
    if result and result[0] == 'active':
        await _remove_temp_role(bot_instance, temp_role_id)


@bot.tree.command(name="发放临时身份组", description="【管理员】给成员发放有时限的身份组")
@app_commands.describe(
    成员="要发放给谁",
    身份组="要发放的身份组",
    到期时间="时长(30m/2h/7d/1d12h)或日期(2025-03-01 12:00)"
)
async def grant_temp_role(
    interaction: discord.Interaction,
    成员: discord.Member,
    身份组: discord.Role,
    到期时间: str
):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
        return
    
    expire_dt = parse_expire_time(到期时间)
    if not expire_dt:
        await interaction.response.send_message(
            "👂 时间格式不对呀～\n"
            "**时长格式：** `30m`、`2h`、`7d`、`1d12h`\n"
            "**日期格式：** `2025-03-01 12:00` 或 `2025-03-01`",
            ephemeral=True
        )
        return
    
    if expire_dt <= datetime.now():
        await interaction.response.send_message("👂 到期时间不能是过去的呀～", ephemeral=True)
        return
    
    await interaction.response.defer(ephemeral=True)
    
    try:
        await 成员.add_roles(身份组, reason=f"临时身份组，由 {interaction.user.name} 发放")
    except Exception as e:
        await interaction.followup.send(f"👂 添加身份组失败了：{str(e)}\n可能是鹅的权限不够呀", ephemeral=True)
        return
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute(
            "INSERT OR REPLACE INTO temp_roles (guild_id, user_id, role_id, granted_by, granted_at, expire_at, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
            (interaction.guild_id, 成员.id, 身份组.id, interaction.user.id, datetime.now().isoformat(), expire_dt.isoformat())
        )
        temp_role_id = c.lastrowid
        conn.commit()
    except Exception as e:
        conn.close()
        await interaction.followup.send(f"👂 记录失败了：{str(e)}", ephemeral=True)
        return
    conn.close()
    
    delay = (expire_dt - datetime.now()).total_seconds()
    asyncio.create_task(_temp_role_timer(bot, temp_role_id, delay))
    
    unix_ts = int(expire_dt.timestamp())
    await interaction.followup.send(
        f"👂 搞定啦！\n"
        f"👤 成员：{成员.mention}\n"
        f"🏷️ 身份组：**{身份组.name}**\n"
        f"⏰ 到期时间：<t:{unix_ts}:F>（<t:{unix_ts}:R>）\n\n"
        f"到期后会自动移除并私信通知哦～",
        ephemeral=True
    )


@bot.tree.command(name="临时身份组列表", description="【管理员】查看当前所有临时身份组，可手动提前移除")
async def list_temp_roles(interaction: discord.Interaction):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
        return
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT id, user_id, role_id, expire_at, granted_by FROM temp_roles WHERE guild_id = ? AND status = 'active' ORDER BY expire_at ASC",
        (interaction.guild_id,)
    )
    entries = c.fetchall()
    conn.close()
    
    if not entries:
        await interaction.response.send_message("👂 目前没有临时身份组哦～", ephemeral=True)
        return
    
    await interaction.response.defer(ephemeral=True)
    guild = interaction.guild
    
    embed = discord.Embed(title="⏰ 当前临时身份组列表", color=0xffaa00)
    select_options = []
    
    for tr_id, user_id, role_id, expire_at, granted_by in entries:
        role = guild.get_role(role_id)
        role_name = role.name if role else f"未知({role_id})"
        try:
            expire_dt = datetime.fromisoformat(expire_at)
            unix_ts = int(expire_dt.timestamp())
            time_str = f"<t:{unix_ts}:R>"
        except Exception:
            time_str = expire_at
        
        embed.add_field(
            name=f"#{tr_id}",
            value=f"👤 <@{user_id}> | 🏷️ **{role_name}** | ⏰ {time_str}",
            inline=False
        )
        if len(select_options) < 25:
            select_options.append(
                discord.SelectOption(
                    label=f"#{tr_id} - {role_name}",
                    description=f"用户ID: {user_id}",
                    value=str(tr_id)
                )
            )
    
    class TempRoleRemoveView(discord.ui.View):
        def __init__(self):
            super().__init__(timeout=180)
            self.select = discord.ui.Select(
                placeholder="👂 选择要提前移除的...",
                options=select_options,
                min_values=1,
                max_values=min(len(select_options), 10),
            )
            self.select.callback = self.remove_selected
            self.add_item(self.select)
        
        async def remove_selected(self, select_interaction: discord.Interaction):
            await select_interaction.response.defer(ephemeral=True)
            removed = []
            failed = []
            for tr_id_str in self.select.values:
                tr_id = int(tr_id_str)
                try:
                    conn = sqlite3.connect(DB_PATH)
                    c = conn.cursor()
                    c.execute("SELECT user_id, role_id FROM temp_roles WHERE id = ? AND status = 'active'", (tr_id,))
                    result = c.fetchone()
                    if not result:
                        conn.close()
                        continue
                    user_id, role_id = result
                    c.execute("UPDATE temp_roles SET status = 'manually_removed' WHERE id = ?", (tr_id,))
                    conn.commit()
                    conn.close()
                    member = guild.get_member(user_id)
                    if not member:
                        try:
                            member = await guild.fetch_member(user_id)
                        except Exception:
                            member = None
                    role = guild.get_role(role_id)
                    if member and role and role in member.roles:
                        await member.remove_roles(role, reason="管理员手动提前移除临时身份组")
                    role_name = role.name if role else f"ID:{role_id}"
                    removed.append(f"#{tr_id} {role_name}")
                except Exception:
                    failed.append(f"#{tr_id}")
            lines = []
            if removed:
                lines.append(f"👂 已移除：{'、'.join(removed)}")
            if failed:
                lines.append(f"⚠️ 移除失败：{'、'.join(failed)}")
            await select_interaction.followup.send("\n".join(lines) if lines else "👂 没有变化", ephemeral=True)
    
    await interaction.followup.send(embed=embed, view=TempRoleRemoveView(), ephemeral=True)


# ============ 管理员：批量删除消息 ============
@bot.tree.command(name="批量删除", description="【管理员】删除当前频道指定范围的消息")
@app_commands.describe(
    起点消息链接="从哪条消息开始删（右键消息→复制消息链接）",
    终点消息链接="删到哪条消息为止（可选，不填则删到最新消息）",
    用户="只删除该用户的消息（可选）"
)
async def bulk_delete(
    interaction: discord.Interaction,
    起点消息链接: str,
    终点消息链接: str = None,
    用户: discord.Member = None
):
    if not is_admin(interaction):
        await interaction.response.send_message("👂 这个只有管理员才能用哦～鹅也没办法呀", ephemeral=True)
        return

    # ---- 解析起点消息链接 ----
    try:
        parts = 起点消息链接.strip().split('/')
        start_msg_id = int(parts[-1])
        start_channel_id = int(parts[-2])
    except (ValueError, IndexError):
        await interaction.response.send_message("👂 起点消息链接格式不对呀～右键消息→复制消息链接，再试试吧", ephemeral=True)
        return

    # 检查链接是否属于当前频道
    channel = interaction.channel
    current_channel_id = channel.id
    if start_channel_id != current_channel_id:
        await interaction.response.send_message("👂 起点消息不在当前频道哦～要在同一个频道里操作呀", ephemeral=True)
        return

    # ---- 解析终点消息链接（可选） ----
    end_msg_id = None
    if 终点消息链接:
        try:
            parts = 终点消息链接.strip().split('/')
            end_msg_id = int(parts[-1])
            end_channel_id = int(parts[-2])
        except (ValueError, IndexError):
            await interaction.response.send_message("👂 终点消息链接格式不对呀～右键消息→复制消息链接，再试试吧", ephemeral=True)
            return
        if end_channel_id != current_channel_id:
            await interaction.response.send_message("👂 终点消息不在当前频道哦～要在同一个频道里操作呀", ephemeral=True)
            return

    await interaction.response.defer(ephemeral=True)

    # ---- 验证起点消息是否存在 ----
    try:
        start_msg = await channel.fetch_message(start_msg_id)
    except discord.NotFound:
        await interaction.followup.send("👂 起点消息不存在呀…可能已经被删了？", ephemeral=True)
        return

    # ---- 验证终点消息（如果有） ----
    end_msg = None
    if end_msg_id:
        try:
            end_msg = await channel.fetch_message(end_msg_id)
        except discord.NotFound:
            await interaction.followup.send("👂 终点消息不存在呀…可能已经被删了？", ephemeral=True)
            return

    # ---- 确保起点在终点之前（用消息ID判断，ID越大越新） ----
    if end_msg and start_msg_id > end_msg_id:
        # 自动交换，用户可能填反了
        start_msg_id, end_msg_id = end_msg_id, start_msg_id
        start_msg, end_msg = end_msg, start_msg

    # ---- 收集范围内的消息 ----
    messages_to_delete = []

    if end_msg:
        # 有终点：收集从起点到终点之间的所有消息
        # after=起点之前一点（包含起点本身），before=终点之后一点（包含终点本身）
        async for msg in channel.history(limit=500, after=discord.Object(id=start_msg_id - 1), before=discord.Object(id=end_msg_id + 1)):
            if 用户 and msg.author.id != 用户.id:
                continue
            messages_to_delete.append(msg)
    else:
        # 无终点：从起点开始一直到最新消息
        async for msg in channel.history(limit=500, after=discord.Object(id=start_msg_id - 1)):
            if 用户 and msg.author.id != 用户.id:
                continue
            messages_to_delete.append(msg)

    if not messages_to_delete:
        await interaction.followup.send("👂 这个范围内没有找到要删的消息呢～", ephemeral=True)
        return

    # ---- 安全上限提示 ----
    if len(messages_to_delete) > 200:
        await interaction.followup.send(
            f"👂 范围内有 **{len(messages_to_delete)}** 条消息，超过200条了！\n"
            "为了安全，鹅最多一次删200条哦～请缩小范围再试试吧",
            ephemeral=True
        )
        return

    # ---- 执行删除 ----
    from datetime import timezone
    now = datetime.now(timezone.utc)
    # Discord 批量删除只支持14天内的消息
    recent = [m for m in messages_to_delete if (now - m.created_at).days < 14]
    old = [m for m in messages_to_delete if (now - m.created_at).days >= 14]

    deleted_count = 0

    # 14天内的消息：批量删除（每次最多100条）
    for i in range(0, len(recent), 100):
        batch = recent[i:i + 100]
        if len(batch) >= 2:
            await channel.delete_messages(batch)
        elif len(batch) == 1:
            await batch[0].delete()
        deleted_count += len(batch)

    # 超过14天的消息：逐条删除
    for msg in old:
        try:
            await msg.delete()
            deleted_count += 1
            await asyncio.sleep(0.5)  # 避免触发速率限制
        except Exception:
            pass

    # ---- 结果反馈 ----
    result_parts = [f"👂 清理完毕！删掉了 **{deleted_count}** 条消息～"]
    if 用户:
        result_parts[0] = f"👂 清理完毕！删掉了 **{用户.display_name}** 的 **{deleted_count}** 条消息～"
    if old:
        result_parts.append(f"（其中 {len(old)} 条是超过14天的旧消息，逐条删除的，比较慢请见谅）")

    await interaction.followup.send("\n".join(result_parts), ephemeral=True)

# ============ 启动 Bot ============
bot.run(BOT_TOKEN)
