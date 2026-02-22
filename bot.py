import os
import discord
from discord.ext import commands

# ============ 基础配置 ============
BOT_TOKEN = os.getenv("BOT_TOKEN")
WELCOME_CHANNEL_ID = 1446888253884989515  # 欢迎频道ID
NEWBIE_QA_LINK = "https://discord.com/channels/1446888252194816132/1447518124696928357"  # 新人提问频道链接

# 标注图片链接
PINNED_MESSAGE_GUIDE_URL = "https://raw.githubusercontent.com/CeciliaLeander/alien-pistachio-bot/main/pinned-message-guide.png"

# 规则消息跳转链接
RULES_LINK = "https://discord.com/channels/1446888252194816132/1447518124696928357/1474661532779544636"

# ============ Bot 初始化 ============
intents = discord.Intents.default()
intents.members = True
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)

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

# ============ 在下方添加新功能 ============
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
#
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
