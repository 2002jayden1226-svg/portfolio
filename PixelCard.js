// PixelCard — 像素风卡片组件，纯 HTML/CSS，匹配 Win95 主题

export default class PixelCard {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      variant: 'pink',   // pink | cyan | green | amber
      title: '',
      glow: true,
      bordered: true,
      ...options
    };
    this._render();
  }

  static getColorScheme(variant) {
    const schemes = {
      pink:   { bg: '#2a0a1a', border: '#ff69b4', glow: '#ff1493', text: '#ffb6c1', accent: '#ff69b4' },
      cyan:   { bg: '#0a1a2a', border: '#00bcd4', glow: '#00e5ff', text: '#b2ebf2', accent: '#00bcd4' },
      green:  { bg: '#0a1a0a', border: '#00ff41', glow: '#39ff14', text: '#98fb98', accent: '#00ff41' },
      amber:  { bg: '#1a1a0a', border: '#ffb300', glow: '#ffab00', text: '#ffe082', accent: '#ffb300' },
    };
    return schemes[variant] || schemes.pink;
  }

  _render() {
    const cs = PixelCard.getColorScheme(this.options.variant);
    const id = 'pc-' + Math.random().toString(36).slice(2, 8);

    this.container.innerHTML = `
      <style>
        #${id} {
          position: relative;
          background: ${cs.bg};
          border: 4px solid;
          border-color: #fff #555 #555 #fff;
          padding: 4px;
          image-rendering: pixelated;
          font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
          box-shadow:
            inset 2px 2px 0 rgba(255,255,255,0.1),
            inset -2px -2px 0 rgba(0,0,0,0.3),
            0 0 20px ${cs.glow}44;
          ${this.options.bordered ? '' : 'border: none; box-shadow: none;'}
        }
        #${id} .pc-inner {
          border: 2px solid ${cs.border};
          padding: 16px;
          position: relative;
          min-height: 80px;
        }
        #${id} .pc-scanlines {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.08) 2px,
            rgba(0,0,0,0.08) 4px
          );
        }
        #${id} .pc-titlebar {
          background: linear-gradient(90deg, ${cs.accent}88, ${cs.glow}44);
          padding: 4px 8px;
          margin-bottom: 8px;
          font-size: 11px;
          font-weight: bold;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid ${cs.border}88;
        }
        #${id} .pc-titlebar::before {
          content: '';
          width: 8px; height: 8px;
          background: ${cs.glow};
          box-shadow: 0 0 6px ${cs.glow};
        }
        #${id} .pc-content {
          color: ${cs.text};
          font-size: 12px;
          line-height: 1.7;
          position: relative;
          z-index: 1;
        }
        #${id} .pc-blink {
          display: inline-block;
          width: 8px; height: 14px;
          background: ${cs.glow};
          margin-left: 4px;
          animation: pc-blink-${id.replace(/-/g,'')} 0.8s step-end infinite;
        }
        @keyframes pc-blink-${id.replace(/-/g,'')} {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        #${id} .pc-corner {
          position: absolute;
          width: 10px; height: 10px;
          border: 2px solid ${cs.border};
        }
        #${id} .pc-corner-tl { top: 2px; left: 2px; border-right: none; border-bottom: none; }
        #${id} .pc-corner-tr { top: 2px; right: 2px; border-left: none; border-bottom: none; }
        #${id} .pc-corner-bl { bottom: 2px; left: 2px; border-right: none; border-top: none; }
        #${id} .pc-corner-br { bottom: 2px; right: 2px; border-left: none; border-top: none; }
      </style>
      <div id="${id}">
        <div class="pc-inner">
          <div class="pc-scanlines"></div>
          <div class="pc-corner pc-corner-tl"></div>
          <div class="pc-corner pc-corner-tr"></div>
          <div class="pc-corner pc-corner-bl"></div>
          <div class="pc-corner pc-corner-br"></div>
          ${this.options.title ? `<div class="pc-titlebar">${this.options.title}<span class="pc-blink"></span></div>` : ''}
          <div class="pc-content">
            ${this.container.dataset.content || 'PixelCard'}
          </div>
        </div>
      </div>
    `;
  }

  updateVariant(variant) {
    this.options.variant = variant;
    this._render();
  }
}
