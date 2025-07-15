import Footer from "../components/footer";

export default function ForgotPasswordPage() {
  return (
    <div className="h-screen flex flex-col">
      <main className="h-full flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md p-6 bg-white border border-gray-200">
          <h1 className="text-2xl font-bold mb-6 text-center">Forgot Password</h1>
          <form className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 font-medium mb-1">
                Email
              </label>
              <input
                type="email"
                required
                className="w-full px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-500 text-sm text-white px-4 py-2 hover:bg-blue-600 transition"
            >
              Reset Password
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}