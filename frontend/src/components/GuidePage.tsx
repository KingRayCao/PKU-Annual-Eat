import { ArrowLeft, ExternalLink, KeyRound, MousePointer2 } from 'lucide-react'

export function GuidePage() {
  return (
    <div className="app-shell guide-shell">
      <header className="topbar">
        <a className="brand-link" href="#/" aria-label="返回燕园今天的饭">
          <div className="brand-mark" aria-hidden="true">燕</div>
          <div>
            <p className="brand-name">燕园今天的饭</p>
          </div>
        </a>
        <a className="topbar-back" href="#/">
          <ArrowLeft size={17} aria-hidden="true" />
          返回账本
        </a>
      </header>

      <main className="guide-main">
        <section className="guide-intro" aria-labelledby="guide-title">
          <p className="eyebrow">查询前准备</p>
          <h1 id="guide-title">获取账号与 Hallticket</h1>
          <p>
            查询需要校园卡账号和当前登录会话的 Hallticket。两项信息只用于本次请求，不会保存在浏览器中。
          </p>
          <a
            className="secondary-button guide-site-link"
            href="https://card.pku.edu.cn/user/user"
            target="_blank"
            rel="noreferrer"
          >
            打开校园卡服务大厅
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </section>

        <section className="guide-step" aria-labelledby="account-step-title">
          <div className="guide-step-copy">
            <span className="step-number" aria-hidden="true">01</span>
            <div>
              <p className="eyebrow">校园卡账号</p>
              <h2 id="account-step-title">从账户管理复制账号</h2>
              <ol>
                <li>登录校园卡服务大厅。</li>
                <li>进入“账户管理”。</li>
                <li>找到账号字段，复制完整数字。</li>
              </ol>
            </div>
          </div>
          <figure className="guide-figure">
            <img src="./guides/account.png" alt="校园卡服务大厅账户管理页面中的账号位置" />
            <figcaption><MousePointer2 size={14} aria-hidden="true" />账户管理中的账号字段</figcaption>
          </figure>
        </section>

        <section className="guide-step is-reversed" aria-labelledby="ticket-step-title">
          <div className="guide-step-copy">
            <span className="step-number" aria-hidden="true">02</span>
            <div>
              <p className="eyebrow">Hallticket</p>
              <h2 id="ticket-step-title">从请求 Cookies 复制会话值</h2>
              <ol>
                <li>按 F12 打开开发者工具，切换到 Network。</li>
                <li>刷新页面，选择 GetCardInfoByAccountNoParm 请求。</li>
                <li>在 Cookies 中找到 hallticket，复制它的值。</li>
              </ol>
            </div>
          </div>
          <figure className="guide-figure">
            <img src="./guides/hallticket.png" alt="浏览器开发者工具 Cookies 中 hallticket 值的位置" />
            <figcaption><KeyRound size={14} aria-hidden="true" />请求 Cookies 中的 hallticket</figcaption>
          </figure>
        </section>

        <section className="guide-finish">
          <div>
            <p className="eyebrow">准备完成</p>
            <h2>回到首页查询流水</h2>
          </div>
          <a className="primary-button" href="#/">
            <ArrowLeft size={16} aria-hidden="true" />
            返回填写信息
          </a>
        </section>
      </main>

      <footer><span>燕园今天的饭</span><span>请勿向他人分享 Hallticket</span></footer>
    </div>
  )
}
