import Link from "next/link";
import Footer from "../dashboard/models/footer";

export default function SupportPage() {
  return (
    <div className="h-screen flex flex-col">
      <main className="h-full flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md p-6 bg-white border border-gray-200">
          <h1 className="text-2xl font-bold mb-6 text-center">Support</h1>
          <p className="text-gray-700 text-sm mb-4">
            If you need assistance, please contact our support team at{" "}
            <Link
              href="mailto:nkosijassiel@gmail.com"
              className="text-blue-600 hover:underline"
            >
              nkosijassiel@gmail.com
            </Link>
            . We are here to help you with any issues or questions you may have.
          </p>
          <p className="text-gray-700 text-sm">
            You can call us at{" "}
            <Link
              href="tel:+27683983265"
              className="text-blue-600 hover:underline"
            >
              +27 68 398 3265
            </Link>
            {" "}for immediate assistance. Our support team is available Monday to Friday from 8 AM to 6 PM.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}