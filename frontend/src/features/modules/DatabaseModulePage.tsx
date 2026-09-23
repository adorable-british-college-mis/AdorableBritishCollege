import { Database, Home } from "lucide-react";

export function DatabaseModulePage({ title }: { title: string }) {
  return <div className="admin-page-container">
    <div className="breadcrumb-nav"><Home size={14} /><span>/</span><span>{title}</span></div>
    <div className="admin-page-header"><div className="admin-page-title-group"><h1>{title}</h1><p>Adorable British College MIS</p></div></div>
    <section className="content-section"><div className="empty-state"><Database size={34} /><h2>No records available</h2><p>This module has no database records or configured workflow yet.</p></div></section>
  </div>;
}
