# grok bot 每周菜单交接：固定内容模板

版本：v14。模板与前端代码同版本交付，开始更新前先拉取最新 main。发布验证结果另见验收记录。

## 没变的工作方式

用户和管家讨论菜单，管家编辑 `index.html`、同周 `weeks/YYYY-MM-DD.html`、主页往期入口与 `weeks/index.html`。不新增 JSON、不运行构建、不必给每餐配图。`CNAME` 保留，README 不写域名。编辑前与推送前同步最新 main，避免与 Codex 同时修改同一文件。

Codex 负责样式、交互、搜索和旧模板兼容。管家只填内容，不复制浏览器动态生成的卡片、弹层或按钮回源文件。

## 文件与可复制模板

- 完整可运行范例：仓库根目录 `index.html`（当前仍是 2026-10-12 周真实内容）。
- 三个内容块范例：[templates/content-sections.html](../templates/content-sections.html)，包含采购、营养、提醒；将对应 section 替换到完整周页面，按新周更新文本。不是独立网页，也不会由页面加载。
- 食谱骨架见下文。每周复制最新已采用的周页更稳妥，不回退到旧脚本引用。
- 新版页面引用 `style.css`、`tabs.js`、`today.js`、`menu-ui.js` 的 `?v=14`。主页用 `assets/`，归档用 `../assets/`。资源版本由 Codex 维护，普通内容更新不变。

## 食谱：已有骨架保持不变

```html
<article id="dMMDD" class="day-article" data-date="YYYY-MM-DD">
  <header><div><h3>星期与日期</h3><p class="muted">当日概要</p></div></header>
  <div class="meal-card">
    <p class="meal-time">早餐</p>
    <h4>菜名及必要用量限定</h4>
    <div class="pillars"><span class="pill">原有营养组成说明</span></div>
    <div class="two-col">
      <div><h5>食材</h5><ul><li>一项食材及用量、必要处理条件</li></ul></div>
      <div><h5>做法</h5><ol><li>一个完整操作步骤</li></ol></div>
    </div>
    <!-- figure 可选，须保留图片来源和文字用量优先的说明 -->
    <p class="note-inline">这餐必须保留的提醒</p>
  </div>
  <!-- 午餐、下午餐同样使用 meal-card；历史两餐页无需补造第三餐 -->
</article>
```

每天的 id、data-date 与周览、日期链接一致。每条食材写一个 li，每个操作步骤写一个 li。不要将多餐内容放进同一个 meal-card。

## 采购：仍用原表格，推荐每个商品一项

保留三列「类别 / 需采购 / 已有或备注」。新菜单推荐在第二列使用：

```html
<tr>
  <td>肉蛋鱼虾</td>
  <td><ul data-shopping-items>
    <li>鲜虾（本周确认的总量与用途）</li>
    <li>牛肉馅（本周确认的总量与用途）</li>
  </ul></td>
  <td>已有食材与此类别的共同备注</td>
</tr>
<tr data-shop-kind="notice">
  <td>本周采购提醒</td><td>需保留的约定</td><td>附加说明</td>
</tr>
```

这是本轮推荐的小改动：商品由管家明确分项，不靠网页猜测。旧版整段文本仍兼容，按括号外的中文分号、顿号拆分；括号不配对时保留整段。`+`、`/` 和逗号不自动拆开，不自动求和、不判断某食材是否家里已有。含用量的括号说明不能丢。

## 营养：人工确定重点，页面只负责显示

在 `section#nutrition[data-tab="nutrition"]` 内保留原有段落、食物搭配和表格。可增加最多三项重点：

```html
<div data-nutrition-summary>
  <article>
    <small>适用餐次或频率</small>
    <h3>项目名</h3>
    <strong>本周确认的约量或安排</strong>
    <p>直接相关的限定条件</p>
  </article>
</div>
<p class="note-inline" data-section-title="这些用量的背景与限定">完整背景与限定</p>
<div class="pillars">
  <span class="pill">食物类别与安排</span>
  <span class="pill">本周食物举例及限定</span>
</div>
```

- 从已确认菜单摘选重点，必须带餐次/频率，保留「约」「按实际食量」等限定。无可靠数量时写安排，不补造数字。
- 每个 `pillars` 写一类食物，首项为类别与安排，后项为食物说明，显示为可展开内容。
- 用 `data-section-title` 给长段落取明确标题，例如「奶与乳制品的安排」。不写时显示为「背景与详细说明」。
- 原有食物盘点表、营养素表继续支持，页面转成逐条记录。无重点卡片的旧页不自动生成本周数字。
- 不因精简而制造营养达标、无需补充等新判断；原有内容矛盾先请用户核对，不能由显示脚本决定。

## 提醒：每条一件事，填写分组标识

保留 `section#notes[data-tab="notes"]` 和 ul/li。在每个 li 增加 `data-note-group`：

| 值 | 用途 |
| --- | --- |
| `focus` | 本周变化、新食物、必须留意的约定、适用范围 |
| `handling` | 去刺、全熟、打细等与具体食物有关的处理要求 |
| `plans` | 家庭安排、日期餐次、新做法概要 |
| `other` | 其他尚未归入前三组的提醒 |

```html
<ul class="notes-list">
  <li data-note-group="focus"><b>新食物</b>：本周具体日期、餐次和条件。</li>
  <li data-note-group="handling"><b>处理对象</b>：具体操作要求。</li>
  <li data-note-group="plans"><b>一道新做法</b>：日期餐次与简短说明，完整步骤在食谱页。</li>
</ul>
```

新做法按每道一条编写，长条目先整理再填。与食谱有关的关键提醒仍放在该餐 `note-inline`，不只留在提醒页。无分组或写了未知值的旧条目会完整进入「其他提醒」，不会消失或阻止页面加载。

## 发布前内容核对

1. 每周日期、餐次、周览和每日做法一致；图片路径及来源正确。
2. 摘要用量与食谱/采购核对，区分每餐、每日和整周，不自行换算生熟重。
3. 同周主页与归档内容一致；两个归档列表都更新。
4. 在手机宽度下逐页看一次，搜一个当周菜名，确认直接进入对应餐次。
5. 本版模板已完成本地兼容检查；后续若要改模板结构，先与用户和 Codex 协调。
