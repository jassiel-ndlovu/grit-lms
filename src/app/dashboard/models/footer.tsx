"use client";

import React from "react";
import { GraduationCap, Mail, Phone, MapPin, ExternalLink,Twitter, Facebook, Instagram, Linkedin, Shield, FileText, HelpCircle, Lock, Globe, ArrowUp } from "lucide-react";

// Crrent path for demonstration
const currPathname = "/dashboard";

export default function ModernStudentFooter() {
  const currentYear = new Date().getFullYear();
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative">
      {/* Scroll to top button */}
      <button
        onClick={scrollToTop}
        className="absolute z-10 -top-6 right-6 w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center group"
        title="Scroll to top"
      >
        <ArrowUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
      </button>

      <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-32 h-32 bg-blue-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-400 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-400 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 container mx-auto px-6 py-12">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            
            {/* Brand Section */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <GraduationCap className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Grit LMS
                  </h3>
                  <p className="text-sm text-gray-300">Learning Management System</p>
                </div>
              </div>
              
              <p className="text-gray-300 text-sm mb-6 max-w-md leading-relaxed">
                Empowering students and educators with cutting-edge learning tools. 
                Build knowledge, track progress, and achieve your academic goals with our comprehensive platform.
              </p>
              
              {/* Contact Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span>nkosijassiel@gmail.com</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Phone className="w-4 h-4 text-blue-400" />
                  <span>+27 68 698 3265</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span>Johannesburg, South Africa</span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-semibold mb-6 text-white">Quick Links</h4>
              <nav className="space-y-3">
                <ModernFooterLink 
                  href="/dashboard" 
                  text="Dashboard" 
                  currentPath={currPathname}
                />
                <ModernFooterLink 
                  href="/courses" 
                  text="Browse Courses" 
                  currentPath={currPathname}
                />
                <ModernFooterLink 
                  href="/submissions" 
                  text="submissions" 
                  currentPath={currPathname}
                />
                <ModernFooterLink 
                  href="/grades" 
                  text="Grades" 
                  currentPath={currPathname}
                />
                <ModernFooterLink 
                  href="/calendar" 
                  text="Calendar" 
                  currentPath={currPathname}
                />
              </nav>
            </div>

            {/* Support & Legal */}
            <div>
              <h4 className="text-lg font-semibold mb-6 text-white">Support & Legal</h4>
              <nav className="space-y-3">
                <ModernFooterLink 
                  href="/help" 
                  text="Help Center" 
                  currentPath={currPathname}
                  icon={<HelpCircle className="w-4 h-4" />}
                />
                <ModernFooterLink 
                  href="/support" 
                  text="Contact Support" 
                  currentPath={currPathname}
                  icon={<Mail className="w-4 h-4" />}
                />
                <ModernFooterLink 
                  href="/privacy-policy" 
                  text="Privacy Policy" 
                  currentPath={currPathname}
                  icon={<Shield className="w-4 h-4" />}
                />
                <ModernFooterLink 
                  href="/terms-of-service" 
                  text="Terms of Service" 
                  currentPath={currPathname}
                  icon={<FileText className="w-4 h-4" />}
                />
                <ModernFooterLink 
                  href="/forgot-password" 
                  text="Reset Password" 
                  currentPath={currPathname}
                  icon={<Lock className="w-4 h-4" />}
                />
              </nav>
            </div>
          </div>

          {/* Social Links & Features */}
          <div className="border-t border-gray-600 pt-8 mb-8">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
              
              {/* Social Media */}
              <div>
                <h5 className="text-sm font-medium mb-4 text-gray-300">Follow Us</h5>
                <div className="flex items-center gap-3">
                  <SocialButton icon={<Twitter className="w-4 h-4" />} label="Twitter" />
                  <SocialButton icon={<Facebook className="w-4 h-4" />} label="Facebook" />
                  <SocialButton icon={<Instagram className="w-4 h-4" />} label="Instagram" />
                  <SocialButton icon={<Linkedin className="w-4 h-4" />} label="LinkedIn" />
                  {/* <SocialButton icon={<Youtube className="w-4 h-4" />} label="YouTube" /> */}
                </div>
              </div>

              {/* Platform Features */}
              <div className="text-center lg:text-right">
                <h5 className="text-sm font-medium mb-4 text-gray-300">Platform Features</h5>
                <div className="flex flex-wrap justify-center lg:justify-end gap-3">
                  {/* <FeatureBadge text="Mobile Friendly" /> */}
                  {/* <FeatureBadge text="24/7 Support" /> */}
                  <FeatureBadge text="Secure & Private" />
                  <FeatureBadge text="Always Updated" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-600 pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>&copy; {currentYear} Grit LMS. All rights reserved.</span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <Globe className="w-4 h-4" />
                  <span>English (ZA)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

type ModernFooterLinkProps = {
  href: string;
  text: string;
  currentPath: string;
  icon?: React.ReactNode;
};

function ModernFooterLink({ href, text, currentPath, icon }: ModernFooterLinkProps) {
  // const isActive = currentPath === href;
  const shouldShowLogin = currentPath === href;

  return (
    <a
      href={shouldShowLogin ? "/" : href}
      className="group flex items-center gap-2 text-gray-300 hover:text-white transition-all duration-200 hover:translate-x-1"
    >
      {icon && (
        <span className="text-blue-400 group-hover:text-blue-300 transition-colors">
          {icon}
        </span>
      )}
      <span className="text-sm">
        {shouldShowLogin ? "Log In" : text}
      </span>
      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

function SocialButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-110 group backdrop-blur-sm"
      title={label}
    >
      <span className="text-gray-300 group-hover:text-white transition-colors">
        {icon}
      </span>
    </button>
  );
}

function FeatureBadge({ text }: { text: string }) {
  return (
    <div className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium text-gray-300 border border-white/20">
      {text}
    </div>
  );
}