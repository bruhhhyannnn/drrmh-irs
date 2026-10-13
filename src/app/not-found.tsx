import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="bg-brand-25 flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="bg-brand-100/50 flex h-16 w-16 items-center justify-center rounded-2xl">
        <span className="text-brand-500 text-3xl font-bold">!</span>
      </div>
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="text-gray-500">Page not found</p>
      <Link
        href="/"
        className="bg-brand-solid hover:brightness-92 mt-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white"
      >
        Go back home
      </Link>
    </div>
  );
}
