# PaperTrail

**把论文精读、研究想法和实验验证串起来的个人研究工作台。**

PaperTrail 通过 Markdown 管理阅读资料，用网页查看正文、问答、思维导图和实验对照。适合与 AI Agent 配合：让 Agent 根据你提供的论文整理内容、维护文件和重建网页，你负责审查事实与研究结论。

发布版本只包含“示例论文”占位内容和空实验列表，**不包含维护者的真实论文、阅读笔记、PDF、实验数据、模型或服务器凭据**。

## 可以做什么

- **阅读总览**：查看阅读停点、主题分布，手动记录阅读活动。
- **论文精读**：按主题阅读论文记录、问答与方法图，支持搜索和专注阅读。
- **收藏与点子**：收藏论文，编辑 Markdown 点子，导入、导出与备份。
- **实验**：按大实验显示卡片，默认标题为“XXX论文优化”，允许改名；点击进入独立详情页，查看思维导图和实验表格；关联的论文名称进入对应精读页面。
- **大白话实验记录**：说明为什么做、怎么做、指标怎样变化、能得出什么结论。每组“原来→现在”应来自同批对照。

## 复制给 Agent，一次完成本地部署

发布后，把以下整段发给具有终端和文件操作能力的 AI Agent。第一次安装依赖需要联网；后续查看网页不需要付费 API、数据库、Node.js 或 GPU。

```text
请在我的电脑上部署并启动 PaperTrail：
https://github.com/Caspainnn/paper-trail.git

请直接执行完整流程：
1. 检查 Git 和 Python 3.11 或更新版本。优先使用现有环境；缺少 Python 时说明缺少什么，并根据当前系统提供安装方式。需要系统安装权限时再询问我。
2. 将仓库克隆到当前工作目录下的 paper-trail。若目录已存在，先确认它是不是这个项目，保留已有文件、浏览器备份和未提交修改，不强制覆盖或重置。
3. 阅读 README.md 和 AGENTS.md。
4. 进入仓库根目录，Windows 执行 py -3 scripts/start.py；macOS/Linux 执行 python3 scripts/start.py。可使用本机等价的 Python 命令。
5. 脚本会创建 .venv、安装 requirements.txt、构建网页、启动仅监听 127.0.0.1 的静态服务并尝试打开浏览器。默认端口8765被占用时会自动寻找后续可用端口。
6. 检查终端打印的访问地址，确认能得到 HTTP 200。运行 python scripts/check.py，使用前面创建的 .venv 中的 Python。若有浏览器工具，再检查首页、示例论文精读和实验入口；若没有浏览器工具，请如实说明只完成了结构与HTTP检查。
7. 把实际访问地址、服务PID和停止方法告诉我。有错误就定位并修复后重试，不要只给我一份操作建议。

只部署本地工作台。保留示例为未阅读状态，不编造真实论文、阅读活动或实验成绩。不要执行 git push、发布远程网站或连接实验服务器。
```

说明：Agent 需要具备执行权限，依赖下载也需要网络授权；遇到系统权限限制时仍可能需要你确认。这里的“一次部署”覆盖应用环境与本地服务，不会自动安装系统级 Python。

## 自己部署

先安装 Git 和 Python 3.11+，然后执行：

```bash
git clone https://github.com/Caspainnn/paper-trail.git
cd paper-trail
python scripts/start.py
```

Windows 可以把 `python` 换成 `py -3`；macOS/Linux 可以换成 `python3`。等待终端出现 `PaperTrail ready: ...`，打开该地址即可。

常用启动选项：

```bash
python scripts/start.py --port 9000
python scripts/start.py --no-open
```

服务信息记录在 `.runtime/server.json`，日志在 `.runtime/server.log`。关闭网页不会停止服务。停止时使用其中的服务 PID：Windows 执行 `Stop-Process -Id <PID>`，macOS/Linux 执行 `kill <PID>`；执行前确认 PID 仍对应本项目的 Python HTTP 服务。

已有符合 requirements.txt 的环境时，可使用 `python scripts/start.py --skip-install` 跳过虚拟环境和安装步骤。该选项仍会构建网页并启动服务。

### 安装依赖失败时

若日志出现代理连接失败、镜像不可达，请先确认本机网络设置。需要临时忽略 pip 的用户配置和环境变量，并改用官方源时，可运行：

```bash
python scripts/start.py --isolated-pip --index-url https://pypi.org/simple
```

这不会修改系统代理或全局 pip 配置。如果你的网络必须使用代理或特定镜像，请使用有效配置，不要加 `--isolated-pip`，并通过 `--index-url` 指定可用源。下载失败不等于依赖不存在；Agent应保留日志并区分网络问题和应用错误。

## 开始使用

1. **先替换示例论文**：把论文材料交给 Agent，并要求按 `templates/论文记录模板.md` 整理到 `readings/论文阅读/论文阅读记录.md`。每篇论文使用唯一的 `P编号`，例如 P01、P02。
2. **重建网页**：使用项目 `.venv` 中的 Python 执行 `readings/论文阅读/网页/build.py`，刷新浏览器即可。
3. **增加主题**：在 `readings/论文阅读/网页/hub.py` 的 `THEMES` 中配置主题、记录文件和方向笔记。不要只修改生成后的 HTML。
4. **记录实验**：在网页里新建大实验并起名。将详情页地址中的 `id` 告诉 Agent，让它在 `experiments/records.json` 中按该 ID 整理事实；重建后展示导图与表格。需要随仓库分享的大实验卡片，写入 `experiments/projects.json`。

可以这样告诉 Agent：

```text
请阅读 AGENTS.md。根据我提供的论文材料更新论文记录，保留真实来源，区分作者结论、我的理解和未验证猜测。不要把待读写成已读。修改源文件后重建网页，核对P编号、问答和本地链接。
```

实验数据的完整格式见 [内容维护说明](docs/CONTENT.md)。新增大实验的默认名称为“XXX论文优化”；自定义标题只显示在卡片顶部绿色区域，详情页主体保持思维导图与表格。

## 文件结构

```text
paper-trail/
├── index.html                     # 构建后的统一入口
├── scripts/start.py               # 环境准备、构建、启动
├── scripts/check.py               # 结构与本地链接检查
├── requirements.txt
├── AGENTS.md                      # Agent工作约定
├── readings/
│   ├── 阅读活动.md
│   ├── 研究笔记/
│   └── 论文阅读/
│       ├── 论文阅读记录.md          # 正文源文件
│       └── 网页/                  # 构建器、模板、样式和本地依赖
├── experiments/
│   ├── projects.json              # 共享的大实验卡片，默认空
│   └── records.json               # 实验事实，默认空
├── templates/
└── docs/CONTENT.md
```

## 数据保存与备份

|内容|保存位置|
|---|---|
|论文正文、已归档阅读活动、实验事实|仓库内的 Markdown/JSON 源文件|
|收藏、点子、未归档活动|当前浏览器的本地存储；使用界面导出备份|
|网页中新建的大实验和自定义标题|当前浏览器的独立本地存储；需要长期共享时让Agent同步到 projects.json|

浏览器保存不等于写回仓库。换浏览器、清理浏览器数据、改变访问协议或端口，都可能让原浏览器数据暂时不可见；建议固定访问地址，并定期导出。Git 只会备份已经写入文件的内容。

## 发布与边界

这是本地静态工作台，没有账号、跨设备同步或服务端数据库。首次依赖安装完成后，页面使用随项目提供的前端库；浏览器自动打开是否成功取决于运行环境，终端地址始终可用。

以后加入自己的论文和实验资料后，上传仓库前请重新检查发布内容。PDF、原始数据、权重、缓存、`.env`、`.venv` 和 `.runtime` 默认忽略；Markdown、JSON 和生成的 HTML 仍可能包含你主动写入的私人信息。

本项目整体许可证尚待维护者确定，不自行宣称为 MIT 或 Apache 项目。第三方前端库及其许可文件位于 `readings/论文阅读/网页/vendor/`，发布时应一并保留。
