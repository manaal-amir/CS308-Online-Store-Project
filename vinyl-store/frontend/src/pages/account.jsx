import { useState } from "react";
import { loginUser, registerUser, API_BASE_URL } from "../services/api.js";
import { getGuestCart, mergeGuestCartAfterLogin } from "../utils/guestCart.js";
import {
  clearAuthSession,
  getAuthSession,
  saveAuthSession,
} from "../utils/authSession.js";
import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import heroImage from "../assets/hero/hero.png";
import "../styles/home.css";
import "../styles/account.css";

const initialWishlist = [
  { title: "The Dark Side of the Moon", artist: "Pink Floyd", price: 29.99, cover: "prism", initials: "PF" },
  { title: "Rumours", artist: "Fleetwood Mac", price: 24.99, cover: "cream", initials: "FM" },
  { title: "Back to Black", artist: "Amy Winehouse", price: 27.99, cover: "portrait", initials: "AW" },
  { title: "IGOR", artist: "Tyler, The Creator", price: 34.99, cover: "pink", initials: "IGOR" },
  { title: "Abbey Road", artist: "The Beatles", price: 32.99, cover: "street", initials: "AB" },
  { title: "Nevermind", artist: "Nirvana", price: 28.99, cover: "blue", initials: "N" },
];

const recommendedRecords = [
  { title: "Kind of Blue", artist: "Miles Davis", price: 26.99, cover: "blue", initials: "MD" },
  { title: "Led Zeppelin IV", artist: "Led Zeppelin", price: 31.99, cover: "cream", initials: "LZ" },
  { title: "Discovery", artist: "Daft Punk", price: 29.99, cover: "pink", initials: "DP" },
];

const profileSections = [
  { href: "/profile", label: "Profile overview", icon: "◉" },
  { href: "/profile#orders", label: "My Orders", icon: "▤" },
  { href: "/wishlist", label: "Wishlist", icon: "♡" },
  { href: "/account-settings", label: "Account Settings", icon: "⚙" },
];

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function Account() {
  const [path, setPath] = useState(window.location.pathname);
  const [session, setSession] = useState(getAuthSession);
  const [wishlist, setWishlist] = useState(initialWishlist);
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister(event) {
    event.preventDefault();
    setNotice("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const password = formData.get("password");
    const confirmPassword = formData.get("confirm-password");

    if (password !== confirmPassword) {
      setNotice("Passwords do not match.");
      return;
    }

    const userData = {
      name: formData.get("name").trim(),
      lastname: formData.get("lastname").trim(),
      taxId: formData.get("taxId").trim(),
      homeAddress: formData.get("homeAddress").trim(),
      email: formData.get("email").trim(),
      password: password,
    };

    try {
      await registerUser(userData);
      setNotice("Account created successfully! You can now sign in.");
      form.reset();
    } catch (error) {
      setNotice(error.message || "Registration failed. Please try again.");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setNotice("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const remember = formData.get("remember") === "on";

    try {
      const authenticated = await loginUser({ email, password });
      saveAuthSession(authenticated, remember);
      setSession(authenticated);

      if (getGuestCart().length > 0) {
        try {
          const mergeResult = await mergeGuestCartAfterLogin(
            authenticated.token,
            API_BASE_URL,
          );
          if (mergeResult?.adjustments?.length) {
            setNotice("You’re signed in. Some cart quantities were adjusted to match available stock.");
          }
        } catch (error) {
          setNotice(
            `You're signed in, but your guest cart could not be synced: ${error.message}`
          );
          return;
        } 
      }
    
      const returnTo =
      new URLSearchParams(window.location.search).get("returnTo");

    const destination =
      returnTo === "/checkout" ? "/checkout" : "/profile";

    if (destination === "/checkout") {
      window.location.assign(destination);
    } else {
      window.history.pushState({}, "", destination);
      setPath(destination);
    }
  } catch (error) {
    setNotice(error.message || "Sign in failed. Please try again.");
  } finally {
    setIsSubmitting(false);
  }
}

function handleLogout(event) {
  event.preventDefault();
  clearAuthSession();
  setSession(null);
  setNotice("You have been signed out.");
  window.history.pushState({}, "", "/sign-in");
  setPath("/sign-in");
}

function pageContent() {
  if (path === "/sign-in") {
    return (
      <AuthPage
        mode="sign-in"
        notice={notice}
        isSubmitting={isSubmitting}
        onSubmit={handleLogin}
        onNotice={setNotice}
      />
    );
  }

  if (path === "/create-account") {
    return (
      <AuthPage
        mode="create-account"
        notice={notice}
        onSubmit={handleRegister}
        onNotice={setNotice}
      />
    );
  }

  if (path === "/wishlist") {
    return (
      <AccountShell activePath={path} user={session?.user} onLogout={handleLogout}>
        <WishlistPage
          records={wishlist}
          onRemove={(title) =>
            setWishlist((records) => records.filter((record) => record.title !== title))
          }
        />
      </AccountShell>
    );
  }

  if (path === "/account-settings") {
    return (
      <AccountShell activePath={path} user={session?.user} onLogout={handleLogout}>
        <SettingsPage notice={notice} setNotice={setNotice} />
      </AccountShell>
    );
  }

  return (
    <AccountShell activePath="/profile" user={session?.user} onLogout={handleLogout}>
      <OverviewPage user={session?.user} notice={notice} />
    </AccountShell>
  );
}

return (
  <div className="vinyl-site account-site">
    <NavBar />
    <main>{pageContent()}</main>
    <Footer />
  </div>
);
  }

function AuthPage({ mode, notice, onSubmit, onNotice, isSubmitting = false }) {
  const isSignIn = mode === "sign-in";

  function handleSubmit(event) {
    if (!isSignIn) {
      const password = event.currentTarget.elements.namedItem("password").value;
      const confirmation = event.currentTarget.elements.namedItem("confirm-password").value;
      if (password !== confirmation) {
        event.preventDefault();
        onNotice("Passwords do not match.");
        return;
      }
    }
    onSubmit(event);
  }

  return (
    <div className={`auth-page${isSignIn ? " is-sign-in" : " is-create-account"}`}>
      <p className="account-breadcrumb">
        <a href="/">Home</a><span>/</span>{isSignIn ? "Sign in" : "Create account"}
      </p>
      <div className="auth-layout">
        <section className="auth-story" style={{ "--auth-image": `url("${heroImage}")` }}>
          <a className="auth-story-mark" href="/">VINYL</a>
          <div>
            <h1>Where Sound<br />Has Soul.</h1>
            <p>The records you love. The ones you’ve yet to find.<br />A listening life, beautifully collected.</p>
          </div>
        </section>
        <section className="auth-form-panel">
          <span className="account-eyebrow">{isSignIn ? "WELCOME BACK" : "JOIN THE COMMUNITY"}</span>
          <h1>{isSignIn ? "Welcome back." : "Create account."}</h1>
          <p className="auth-intro">
            {isSignIn
              ? "Sign in to your account to continue."
              : "Make room for good music. Create your account to get started."}
          </p>
          <form onSubmit={handleSubmit}>
            {!isSignIn && (
              <>
                <label htmlFor="account-name">First name</label>
                <input
                  id="account-name"
                  name="name"
                  autoComplete="given-name"
                  placeholder="Your first name"
                  required
                />

                <label htmlFor="account-lastname">Last name</label>
                <input
                  id="account-lastname"
                  name="lastname"
                  autoComplete="family-name"
                  placeholder="Your last name"
                  required
                />

                <label htmlFor="account-tax-id">Tax ID</label>
                <input
                  id="account-tax-id"
                  name="taxId"
                  type="text"
                  placeholder="Your tax ID"
                  required
                />

                <label htmlFor="account-address">Home address</label>
                <input
                  id="account-address"
                  name="homeAddress"
                  autoComplete="street-address"
                  placeholder="Your home address"
                  required
                />
              </>
            )}
            <label htmlFor="account-email">Email address</label>
            <input id="account-email" name="email" type="email" autoComplete="email" placeholder="Your email address" required />
            <label htmlFor="account-password">Password</label>
            <input
              id="account-password"
              name="password"
              type="password"
              autoComplete={isSignIn ? "current-password" : "new-password"}
              placeholder={isSignIn ? "Your password" : "Create a password"}
              minLength="8"
              required
            />
            {!isSignIn && (
              <>
                <label htmlFor="account-confirm-password">Confirm password</label>
                <input id="account-confirm-password" name="confirm-password" type="password" autoComplete="new-password" placeholder="Re-enter your password" minLength="8" required />
              </>
            )}
            {isSignIn && (
              <div className="auth-form-options">
                <label className="auth-checkbox"><input type="checkbox" name="remember" /> Remember me</label>
                <a href="#forgot-password" onClick={(event) => {
                  event.preventDefault();
                  onNotice("Password recovery is not connected in this preview.");
                }}>Forgot password?</a>
              </div>
            )}
            <button className="account-primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Signing in…"
                : isSignIn ? "Log in" : "Create Account"}
            </button>
            {notice && <p className="account-notice" role="status">{notice}</p>}
          </form>
          <p className="auth-switch">
            {isSignIn ? "New to VINYL?" : "Already have an account?"}{" "}
            <a href={isSignIn ? "/create-account" : "/sign-in"}>
              {isSignIn ? "Create an account" : "Sign in"}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}

function AccountShell({ activePath, children, user, onLogout }) {
  const accountLabel = user?.email?.split("@")[0] || "Your account";
  const initials = accountLabel
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "A";

  return (
    <div className="account-page">
      <p className="account-breadcrumb">
        <a href="/">Home</a><span>/</span><a href="/profile">My Account</a><span>/</span>
        {profileSections.find((section) => section.href === activePath)?.label || "Profile overview"}
      </p>
      <div className="account-layout">
        <aside className="account-sidebar">
          <div className="account-avatar">{initials}</div>
          <h2>{accountLabel}</h2>
          {user?.email && <p>{user.email}</p>}
          <a className="account-edit-link" href="/account-settings">Edit Profile</a>
          <nav aria-label="Account navigation">
            {profileSections.map((section) => (
              <a
                href={section.href}
                className={section.href === activePath ? "is-active" : ""}
                key={section.href}
                aria-current={section.href === activePath ? "page" : undefined}
              >
                <span aria-hidden="true">{section.icon}</span>{section.label}
              </a>
            ))}
            <a href="/sign-in" onClick={onLogout}><span aria-hidden="true">↪</span>Log Out</a>
          </nav>
          <div className="sidebar-help">
            <h3>Need a hand?</h3>
            <p>We’re here to help with your orders and account.</p>
            <a href="mailto:hello@vinyl.example">Contact our team →</a>
          </div>
        </aside>
        <section className="account-content">{children}</section>
      </div>
    </div>
  );
}

function OverviewPage({ user, notice }) {
  return (
    <>
      <header className="account-heading">
        <span className="account-eyebrow">MY ACCOUNT</span>
        <h1>Profile overview</h1>
        <p>Your listening life, all in one place.</p>
      </header>
      {notice && <p className="account-notice" role="status">{notice}</p>}
      <div className="account-stat-grid">
        <StatCard label="Total orders" value="04" detail="Since you joined" />
        <StatCard label="Wishlist" value="06" detail="Records saved for later" />
        <StatCard label="Member since" value="2022" detail="A lover of good sound" />
      </div>
      <div className="overview-columns">
        <section className="account-panel latest-order" id="orders">
          <div className="account-panel-heading">
            <div><span className="account-eyebrow">YOUR LATEST ORDER</span><h2>Order #VN-2048</h2></div>
            <a href="/shop?sort=newest">View all orders →</a>
          </div>
          <p className="order-date">Placed on October 12, 2024 <span className="order-status">Delivered</span></p>
          <div className="order-record">
            <RecordArtwork record={initialWishlist[0]} />
            <div><h3>The Dark Side of the Moon</h3><p>Pink Floyd · Vinyl, 180g</p><span>Qty 1 <b>$29.99</b></span></div>
          </div>
          <div className="order-total"><span>Order total</span><strong>$29.99</strong></div>
        </section>
        <section className="account-panel account-details">
          <div className="account-panel-heading">
            <div><span className="account-eyebrow">YOUR DETAILS</span><h2>Account information</h2></div>
            <a href="/account-settings">Edit →</a>
          </div>
          <dl>
            {user?.email ? (
              <>
                <div><dt>Account ID</dt><dd>{user.id}</dd></div>
                <div><dt>Email</dt><dd>{user.email}</dd></div>
                <div><dt>Role</dt><dd>{user.role}</dd></div>
              </>
            ) : (
              <>
                <div><dt>Name</dt><dd>Jamie Laurent</dd></div>
                <div><dt>Email</dt><dd>jamie.laurent@email.com</dd></div>
                <div><dt>Address</dt><dd>Brooklyn, New York</dd></div>
              </>
            )}
          </dl>
        </section>
      </div>
      <section className="account-recommendations">
        <div className="account-panel-heading">
          <div><span className="account-eyebrow">CURATED FOR YOU</span><h2>You might also love</h2></div>
          <a href="/shop">Explore all records →</a>
        </div>
        <div className="account-mini-grid">
          {recommendedRecords.map((record) => <MiniRecord key={record.title} record={record} />)}
        </div>
      </section>
    </>
  );
}

function StatCard({ label, value, detail }) {
  return <article className="account-stat-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function WishlistPage({ records, onRemove }) {
  const [sort, setSort] = useState("recent");
  const sortedRecords = [...records].sort((first, second) => {
    if (sort === "artist") return first.artist.localeCompare(second.artist);
    if (sort === "price") return first.price - second.price;
    return initialWishlist.findIndex((record) => record.title === first.title) -
      initialWishlist.findIndex((record) => record.title === second.title);
  });

  return (
    <>
      <header className="account-heading wishlist-heading">
        <div><span className="account-eyebrow">SAVED FOR A GOOD DAY</span><h1>Your Wishlist</h1><p>The records you love, waiting for their moment.</p></div>
        <label className="wishlist-sort">Sort by
          <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recently saved</option><option value="artist">Artist</option><option value="price">Price</option></select>
        </label>
      </header>
      {records.length ? (
        <div className="wishlist-grid">
          {sortedRecords.map((record) => (
            <WishlistCard key={record.title} record={record} onRemove={() => onRemove(record.title)} />
          ))}
        </div>
      ) : (
        <div className="empty-wishlist"><span aria-hidden="true">♡</span><h2>Your wishlist is waiting.</h2><p>Save a few records and they’ll find a home here.</p><a className="account-primary-button" href="/shop">Browse records</a></div>
      )}
      <p className="wishlist-footnote">♡ Select the heart on a record to save it to your wishlist.</p>
    </>
  );
}

function WishlistCard({ record, onRemove }) {
  const [added, setAdded] = useState(false);
  return (
    <article className="wishlist-card">
      <div className="wishlist-artwork">
        <RecordArtwork record={record} />
        <button type="button" className="wishlist-remove" onClick={onRemove} aria-label={`Remove ${record.title} from wishlist`}>♥</button>
      </div>
      <div className="wishlist-record-info">
        <p>{record.artist}</p><h2>{record.title}</h2>
        <strong>{formatPrice(record.price)}</strong>
      </div>
      <button className="account-primary-button wishlist-add" type="button" onClick={() => setAdded(true)}>
        {added ? "Added to Cart" : "Add to Cart"}
      </button>
    </article>
  );
}

function SettingsPage({ notice, setNotice }) {
  const [preferences, setPreferences] = useState({ updates: true, offers: true, recommendations: false });

  function saveSettings(event) {
    event.preventDefault();
    setNotice("Your changes have been saved in this preview.");
  }

  function togglePreference(key) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
    setNotice("");
  }

  return (
    <>
      <header className="account-heading">
        <span className="account-eyebrow">MY ACCOUNT / ACCOUNT SETTINGS</span>
        <h1>Account Settings</h1>
        <p>Manage your personal information and preferences.</p>
      </header>
      <form className="settings-form" onSubmit={saveSettings}>
        <section className="settings-panel">
          <div className="settings-section-heading"><span className="account-avatar small">JL</span><div><h2>Personal information</h2><p>Your details help us make your experience more personal.</p></div></div>
          <div className="settings-fields">
            <label>First name<input name="firstName" defaultValue="Jamie" /></label>
            <label>Last name<input name="lastName" defaultValue="Laurent" /></label>
            <label>Email address<input name="email" type="email" defaultValue="jamie.laurent@email.com" /></label>
            <label>Location<input name="location" defaultValue="Brooklyn, New York" /></label>
            <label className="settings-bio">A little about you<textarea name="bio" defaultValue="Sunday mornings, a fresh coffee, and a record with a story to tell." rows="3" /></label>
          </div>
        </section>
        <section className="settings-panel preferences-panel">
          <div><span className="account-eyebrow">STAY IN THE GROOVE</span><h2>Your preferences</h2></div>
          <PreferenceToggle title="Wishlist updates" description="Get updates when records on your wishlist are back in stock." checked={preferences.updates} onChange={() => togglePreference("updates")} />
          <PreferenceToggle title="Special offers" description="Hear about new releases, member perks, and special offers." checked={preferences.offers} onChange={() => togglePreference("offers")} />
          <PreferenceToggle title="Personal recommendations" description="Receive picks based on the records and genres you love." checked={preferences.recommendations} onChange={() => togglePreference("recommendations")} />
        </section>
        <section className="settings-panel security-panel">
          <div><span className="account-eyebrow">KEEP YOUR ACCOUNT SAFE</span><h2>Password &amp; security</h2></div>
          <div className="security-row"><div><strong>Password</strong><p>Last updated a while ago</p></div><a href="/sign-in">Change password →</a></div>
          <div className="security-row"><div><strong>Two-step verification</strong><p>Add an extra layer of security to your account.</p></div><button type="button" onClick={() => setNotice("Two-step verification is not connected in this preview.")}>Set up →</button></div>
        </section>
        {notice && <p className="account-notice settings-notice" role="status">{notice}</p>}
        <div className="settings-actions"><button className="account-primary-button" type="submit">Save Changes</button><a className="account-secondary-button" href="/profile">Cancel</a><span>Changes save to this preview only.</span></div>
      </form>
    </>
  );
}

function PreferenceToggle({ title, description, checked, onChange }) {
  return (
    <label className="preference-row">
      <span><strong>{title}</strong><small>{description}</small></span>
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} />
    </label>
  );
}

function MiniRecord({ record }) {
  return (
    <article className="mini-record">
      <a href="/shop" className="mini-record-art"><RecordArtwork record={record} /></a>
      <h3>{record.artist}</h3><p>{record.title}</p><strong>{formatPrice(record.price)}</strong>
    </article>
  );
}

function RecordArtwork({ record }) {
  return (
    <span className={`record-artwork art-${record.cover}`} aria-label={`${record.title} cover placeholder`}>
      <span className="record-art-disc" aria-hidden="true" />
      <span className="record-art-label" aria-hidden="true">{record.initials}</span>
      {record.cover === "prism" && <span className="record-prism" aria-hidden="true" />}
      {record.cover === "street" && <span className="record-crosswalk" aria-hidden="true" />}
      <span className="record-art-title">{record.title}</span>
    </span>
  );
}
