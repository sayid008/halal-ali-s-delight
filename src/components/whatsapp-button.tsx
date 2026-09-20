import { useLocation } from "@tanstack/react-router";
import { restaurant } from "@/data/menu";

const WHATSAPP_NUMBER = "918431903828";
const WHATSAPP_MESSAGE = `Hello ${restaurant.name}, I would like to get in touch with you.`;

export function WhatsAppButton() {
  const location = useLocation();
  const pathname = location.pathname;

  // Do not show on admin panel or menu page
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/menu" ||
    pathname.startsWith("/menu/")
  ) {
    return null;
  }

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="group fixed bottom-24 right-4 z-50 flex items-center md:bottom-6 md:right-6"
    >
      {/* Desktop Hover Tooltip (No order text, purely chat) */}
      <span className="pointer-events-none absolute right-full mr-3 hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-neutral-900/90 px-3.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl backdrop-blur-md transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100 sm:flex">
        <span>Chat with us</span>
      </span>

      {/* Floating Animated WhatsApp Button */}
      <div className="relative flex items-center justify-center">
        {/* Soft Ambient Glow Effect */}
        <span className="absolute -inset-1 rounded-full bg-[#25D366]/40 blur-md transition-opacity duration-300 group-hover:bg-[#25D366]/60 group-hover:blur-lg" />

        {/* Subtle Pulse Ring Animation */}
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30 duration-1000" />

        {/* Main WhatsApp Disc */}
        <div className="relative flex size-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#128C7E] via-[#25D366] to-[#38e678] text-white shadow-[0_8px_25px_rgba(37,211,102,0.45)] ring-2 ring-white/40 transition-all duration-300 ease-out group-hover:scale-110 group-hover:shadow-[0_12px_32px_rgba(37,211,102,0.6)] active:scale-95 sm:size-15">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-7 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)] sm:size-8"
            aria-hidden="true"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.371-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </div>
      </div>
    </a>
  );
}
