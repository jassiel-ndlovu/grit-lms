import Footer from "../components/footer";

export default function PrivacyPolicyPage() {
  return (
    <div className="h-screen flex flex-col">
      <main className="h-full flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-2xl p-6 bg-white border border-gray-200">
          <h1 className="text-2xl font-bold mb-6 text-center">Privacy Policy</h1>
          <p className="text-gray-700 text-sm mb-4">
            At Grit LMS, we value your privacy and are committed to protecting your personal information. This Privacy Policy outlines how we collect, use, and safeguard your data.
          </p>
          <h2 className="text-lg font-semibold mt-4">Information We Collect</h2>
          <p className="text-gray-700 text-sm mb-4">
            We collect personal information such as your name, email address, and any other details you provide when you register or use our services.
          </p>
          <h2 className="text-lg font-semibold mt-4">How We Use Your Information</h2>
          <p className="text-gray-700 text-sm mb-4">
            Your information is used to provide and improve our services, communicate with you, and ensure the security of our platform.
          </p>
          <h2 className="text-lg font-semibold mt-4">Data Security</h2>
          <p className="text-gray-700 text-sm mb-4">
            We implement appropriate security measures to protect your personal information from unauthorized access or disclosure.
          </p>
          <h2 className="text-lg font-semibold mt-4">Changes to This Policy</h2>
          <p className="text-gray-700 text-sm mb-4">
            We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}