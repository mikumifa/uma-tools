import { h } from "preact";

import "./IntroText.css";

export function IntroText(props) {
  return (
    <div id="introtext">
      <footer id="sourcelinks">
        本项目为国服版本，基于原作者项目 fork 改造：
        <a href="https://github.com/alpha123/uma-skill-tools">simulator</a>、
        <a href="https://github.com/alpha123/uma-tools">UI</a>
        <br />
        GitHub 仓库链接：<a href="https://github.com/mikumifa/uma-tools">UI</a>
        <br />
      </footer>
    </div>
  );
}
