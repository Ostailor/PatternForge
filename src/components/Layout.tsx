import Navbar from "./Navbar";

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#f7f9fb] text-slate-950">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
