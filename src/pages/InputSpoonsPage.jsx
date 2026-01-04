import React from "react";

function RestCard({ title, subtitle, emoji }) {
  return (
    <button className="restCard" type="button">
      <div className="restEmoji" aria-hidden="true">{emoji}</div>
      <div className="restTitle">{title}</div>
      <div className="restSubtitle">{subtitle}</div>
    </button>
  );
}

export default function InputSpoonsPage() {
  return (
    <div className="spoonsPage">
      <div className="restRow">
        <RestCard title="Short rest" subtitle="Quick reset" emoji="🐈" />
        <RestCard title="Half rest" subtitle="Medium reset" emoji="🐈‍⬛" />
        <RestCard title="Full rest" subtitle="Full reset" emoji="😴" />
      </div>
    </div>
  );
}
