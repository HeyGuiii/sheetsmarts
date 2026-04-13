import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 gap-6">
      <h1 className="text-4xl font-bold text-center tracking-tight">
        SheetSmarts
      </h1>
      <p className="text-lg text-gray-500 text-center">
        Your piano practice buddy
      </p>

      <div className="flex flex-col gap-5 w-full max-w-sm mt-4">
        <Link href="/snap" className="block">
          <div className="bg-blue-500 hover:bg-blue-600 active:scale-[0.98] transition-all text-white rounded-2xl p-8 text-center shadow-lg">
            <div className="text-5xl mb-3">📷</div>
            <div className="text-2xl font-bold mb-1">Snap & Play</div>
            <div className="text-blue-100 text-sm">
              Take a photo of your music and hear how it sounds
            </div>
          </div>
        </Link>

        <Link href="/practice" className="block">
          <div className="bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition-all text-white rounded-2xl p-8 text-center shadow-lg">
            <div className="text-5xl mb-3">🎹</div>
            <div className="text-2xl font-bold mb-1">Practice</div>
            <div className="text-orange-100 text-sm">
              Play along and get feedback on how you did
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
