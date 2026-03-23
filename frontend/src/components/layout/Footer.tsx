export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} Track-That. Find the best local deals.</p>
      </div>
    </footer>
  );
}
