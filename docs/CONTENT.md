# 内容维护

论文：在主题Markdown中使用 `## P01｜论文标题`，按照模板填写字段。`hub.py` 的 `THEMES` 指定主题源文件；所有主题之间P编号不能重复。`current: True` 的主题需至少有一篇记录。发行版保留一篇明确标注的占位示例。

共享实验卡片 `experiments/projects.json`：

```json
[{"id":"example-project","paper":"示例论文","title":"示例论文优化"}]
```

实验事实 `experiments/records.json`：

```json
{
  "example-project": {
    "paperPid": "P01",
    "experiments": [{
      "id": "first-attempt",
      "question": "本次想验证的问题",
      "reason": "为什么值得做",
      "method": "怎样比较，哪些条件保持一致",
      "metrics": [],
      "conclusion": "尚未运行，不能判断效果"
    }]
  }
}
```

指标数组中的每项使用 `label`、`before`、`after`、`unit`、`batch` 五个字段。只有真实运行且可追溯的结果才填写数值；`batch`说明同批对照与样本范围。空数组显示待填写，不用占位数字伪装成绩。

`paperPid` 必须匹配阅读记录中的论文。若未指定，则按论文名称匹配；未匹配到就不显示精读链接。

浏览器创建的卡片ID在详情页URL中，通常以 `exp-` 开头。让Agent维护该ID对应的记录；若希望共享到其他设备，再把卡片对象写入projects.json。

重建：用`.venv`中的Python运行 `readings/论文阅读/网页/build.py`，然后运行 `scripts/check.py`。静态服务通常无需重启，刷新页面即可。
