import Link from "next/link";
export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-slate-500">That page or item doesn’t exist.</p>
      <Link href="/directory" className="mt-6 inline-block rounded-md bg-accent px-4 py-2 font-medium text-white">
        Browse the directory
      </Link>
    </div>
  );
}
