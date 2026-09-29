// 语言切换器 —— 由 book.toml 的 additional-js 注入到每一页的顶栏。
// 站点 URL 结构（GitHub Pages 项目站点 + 本地合并目录均适用）：
//   .../deer-gui-docs/<page>        简体中文（默认，位于站点根）
//   .../deer-gui-docs/en/<page>     English
//   .../deer-gui-docs/zh-TW/<page>  繁體中文
// 本地用静态服务器 serve 合并后的 book/ 目录时没有 deer-gui-docs 前缀，逻辑同样成立。
(function () {
    "use strict";

    var LANGS = [
        { code: "",      label: "简体中文" },
        { code: "en",    label: "English" },
        { code: "zh-TW", label: "繁體中文" }
    ];

    // 把当前路径拆成 base（站点前缀）+ 当前语言 + 语言内剩余路径
    function splitPath() {
        var p = location.pathname;
        var base = "/";
        var rest = p.replace(/^\/+/, "");
        if (rest.indexOf("deer-gui-docs/") === 0) {
            base = "/deer-gui-docs/";
            rest = rest.slice("deer-gui-docs/".length);
        }
        var lang = "";
        if (rest.indexOf("en/") === 0) {
            lang = "en";
            rest = rest.slice(3);
        } else if (rest.indexOf("zh-TW/") === 0) {
            lang = "zh-TW";
            rest = rest.slice(6);
        }
        return { base: base, lang: lang, rest: rest };
    }

    var cur = splitPath();

    var select = document.createElement("select");
    select.id = "lang-switcher";
    select.setAttribute("aria-label", "Language / 语言");
    select.style.cssText =
        "height:30px;margin:0 8px 0 0;padding:0 2px;font-size:.875rem;" +
        "color:var(--fg,#333);background:var(--bg,#fff);" +
        "border:1px solid var(--icons,#ccc);border-radius:2px;cursor:pointer;";

    LANGS.forEach(function (l) {
        var opt = document.createElement("option");
        opt.value = l.code;
        opt.textContent = l.label;
        if (l.code === cur.lang) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });

    select.addEventListener("change", function () {
        var code = select.value;
        location.href = cur.base + (code ? code + "/" : "") + cur.rest;
    });

    function mount() {
        var bar = document.querySelector(".right-buttons");
        if (bar) {
            bar.insertBefore(select, bar.firstChild);
        } else {
            document.body.appendChild(select);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mount);
    } else {
        mount();
    }
})();
