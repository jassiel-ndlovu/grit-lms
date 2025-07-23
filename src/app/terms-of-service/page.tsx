import Footer from "../dashboard/models/footer";

export default function PrivacyPolicyPage() {
  return (
    <div className="h-screen flex flex-col">
      <main className="h-full flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-2xl p-6 bg-white border border-gray-200">
          <h1 className="text-2xl font-bold mb-6 text-center">Terms of Service</h1>
          <p className="text-gray-700 text-sm mb-4">
            Welcome to Grit LMS. By using our services, you agree to comply with and be bound by the following terms and conditions.
          </p>
          <h2 className="text-lg font-semibold mt-4">Acceptance of Terms</h2>
          <p className="text-gray-700 text-sm mb-4">
            By accessing or using our platform, you agree to these Terms of Service. If you do not agree, please do not use our services.
          </p>
          <h2 className="text-lg font-semibold mt-4">User Responsibilities</h2>
          <p className="text-gray-700 text-sm mb-4">
            You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.
          </p>
          <h2 className="text-lg font-semibold mt-4">Modifications to Terms</h2>
          <p className="text-gray-700 text-sm mb-4">
            We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting on this page.
          </p>
          <h2 className="text-lg font-semibold mt-4">Limitation of Liability</h2>
          <p className="text-gray-700 text-sm mb-4">
            Grit LMS will not be liable for any direct, indirect, incidental, or consequential damages arising from your use of our services.
          </p>
          <h2 className="text-lg font-semibold mt-4">Governing Law</h2>
          <p className="text-gray-700 text-sm mb-4">
            These terms are governed by the laws of the jurisdiction in which Grit LMS operates. Any disputes will be resolved in the courts of that jurisdiction.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}