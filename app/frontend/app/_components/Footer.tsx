import { Github, Twitter, BookOpen } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-surface/50 backdrop-blur-lg">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold gradient-text">BlindBet</h3>
            <p className="text-gray-400 text-sm">
              Confidential prediction markets powered by Fully Homomorphic Encryption
            </p>
          </div>

          {/* Product Links */}
          <div className="space-y-4">
            <h4 className="text-white font-semibold">Product</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/markets" className="text-gray-400 hover:text-brand-primary transition-colors">
                  Markets
                </Link>
              </li>
              <li>
                <Link href="/create" className="text-gray-400 hover:text-brand-primary transition-colors">
                  Create Market
                </Link>
              </li>
              <li>
                <Link href="/my-tokens" className="text-gray-400 hover:text-brand-primary transition-colors">
                  My Tokens
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h4 className="text-white font-semibold">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://docs.zama.ai"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-brand-primary transition-colors"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/zama-ai/fhevm"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-400 hover:text-brand-primary transition-colors"
                >
                  FHEVM Docs
                </a>
              </li>
            </ul>
          </div>

          {/* Social Links */}
          <div className="space-y-4">
            <h4 className="text-white font-semibold">Connect</h4>
            <div className="flex gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-surface-hover hover:bg-brand-primary/20 text-gray-400 hover:text-brand-primary transition-all"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-surface-hover hover:bg-brand-primary/20 text-gray-400 hover:text-brand-primary transition-all"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://docs.zama.ai"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-surface-hover hover:bg-brand-primary/20 text-gray-400 hover:text-brand-primary transition-all"
              >
                <BookOpen className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} BlindBet. Built with Zama's FHEVM.
          </p>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-brand-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-brand-primary transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}





