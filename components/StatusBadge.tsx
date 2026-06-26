export function StatusBadge({ inStock }: { inStock: boolean }) {
  return inStock ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
      In stock
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
      Out
    </span>
  );
}
