import NavBar from "../components/layout/navBar.jsx";
import Footer from "../components/layout/footer.jsx";
import { getAuthSession } from "../utils/authSession.js";
import "../styles/orders.css";
import "../styles/staffPanel.css";

const overviewTab = { href: "/manager", label: "Overview" };

const staffRoles = {
  PRODUCT_MANAGER: { title: "Product management", tabs: [
    overviewTab,
    { href: "/manager/deliveries", label: "Deliveries" },
  ] },
  SALES_MANAGER: { title: "Sales management", tabs: [overviewTab] },
  SUPPORT_AGENT: { title: "Customer support", tabs: [overviewTab] },
};

export default function StaffPanel({ path, children }) {
  const session = getAuthSession();
  const panel = Object.hasOwn(staffRoles, session?.user?.role)
    ? staffRoles[session.user.role]
    : null;
  const currentTab = panel?.tabs.find((tab) => tab.href === path);

  return (
    <div className="vinyl-site orders-site">
      <NavBar />
      <main className="orders-page orders-page-wide">
        {!session && (
          <p className="orders-state"><a href="/sign-in">Sign in</a> to open the staff panel.</p>
        )}
        {session && !panel && (
          <p className="orders-state" role="alert">This panel is available to staff only.</p>
        )}
        {panel && (
          <>
            <header className="staff-panel-header">
              {path === "/manager" ? <h1>{panel.title}</h1> : <p>{panel.title}</p>}
              <nav aria-label="Staff menu" className="staff-panel-tabs">
                {panel.tabs.map(({ href, label }) => (
                  <a key={href} href={href} aria-current={path === href ? "page" : undefined}>
                    {label}
                  </a>
                ))}
              </nav>
            </header>
            {currentTab === overviewTab && (
              <p className="orders-state">
                {panel.tabs.length > 1
                  ? "Open Deliveries to review orders and update delivery status."
                  : "No additional panels are available for your role yet."}
              </p>
            )}
            {currentTab && children}
            {!currentTab && (
              <p className="orders-state" role="alert">This page is unavailable for your account.</p>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
