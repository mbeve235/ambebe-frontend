import React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const quickLinks = [
  { href: "/", label: "Inicio" },
  { href: "/#produtos", label: "Loja / Produtos" },
  { href: "/sobre-nos", label: "Sobre nos" },
  { href: "/categorias", label: "Categorias" },
  { href: "/ajuda", label: "Ajuda / Suporte" }
];

const accountLinks = [{ href: "/cliente/suporte", label: "Falar com suporte" }];

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
const supportWhatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;

const socialLinks = [
  supportWhatsapp
    ? {
        href: `https://wa.me/${supportWhatsapp.replace(/\D/g, "")}`,
        label: "WhatsApp",
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
            <path
              fill="currentColor"
              d="M12.04 2a9.94 9.94 0 0 0-8.52 15.08L2 22l5.1-1.34A9.94 9.94 0 1 0 12.04 2Zm0 1.73a8.2 8.2 0 0 1 6.8 12.77l.38.57-.78.4a8.2 8.2 0 0 1-4.2 1.23 8.1 8.1 0 0 1-3.92-1.02l-.39-.21-2.98.78.8-2.88-.26-.4a8.17 8.17 0 0 1-1.2-4.2 8.2 8.2 0 0 1 8.35-8.04Zm-3.06 4.32c-.2 0-.42.07-.55.21-.13.14-.53.52-.53 1.26 0 .74.54 1.46.62 1.56.08.1 1.07 1.71 2.62 2.33 1.29.5 1.55.4 1.83.37.28-.03.9-.37 1.03-.74.13-.37.13-.69.09-.74-.04-.05-.15-.08-.32-.16-.17-.08-1.03-.5-1.19-.56-.16-.06-.28-.1-.4.1-.12.2-.46.56-.57.67-.1.12-.2.13-.37.05-.17-.08-.7-.26-1.34-.83-.5-.45-.84-1.02-.94-1.19-.1-.17-.01-.26.07-.35.07-.07.17-.2.26-.3.09-.1.12-.17.18-.29.06-.12.03-.23-.01-.31-.04-.08-.38-.94-.52-1.29-.13-.35-.27-.3-.37-.3Z"
            />
          </svg>
        )
      }
    : null,
  supportEmail
    ? {
        href: `mailto:${supportEmail}`,
        label: "Gmail",
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
            <path
              fill="currentColor"
              d="M4.2 5.5h15.6c.94 0 1.7.76 1.7 1.7v9.6c0 .94-.76 1.7-1.7 1.7H4.2a1.7 1.7 0 0 1-1.7-1.7V7.2c0-.94.76-1.7 1.7-1.7Zm0 1.6 7.8 5.2 7.8-5.2H4.2Zm15.6 9.8v-8l-7.8 5.2-7.8-5.2v8h15.6Z"
            />
          </svg>
        )
      }
    : null
].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

export function Footer() {
  return (
    <footer className="border-t border-border/70 bg-surface/70 backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <BrandLogo size={40} />
              <div>
                <div className="font-heading text-lg text-text"><strong>A</strong>MBEBE </div>
                <div className="text-xs text-muted"><strong>A</strong>MBEBE CORP</div>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted">
              Tecnologia com confianca, atendimento simples e compras sem complicacao.
            </p>
          </div>

          <div>
            <div className="text-sm font-semibold text-text">Navegacao</div>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
              {quickLinks.map((item) => (
                <Link key={item.href} href={item.href} className="transition hover:text-primary">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-text">Minha conta</div>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
              {accountLinks.map((item) => (
                <Link key={item.href} href={item.href} className="transition hover:text-primary">
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 text-xs text-muted">
              Precisa de ajuda? Use o suporte para falar com a nossa equipe.
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-text">Redes sociais</div>
            {socialLinks.length ? (
              <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
                {socialLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-2 transition hover:text-primary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.icon}
                    {item.label}
                  </a>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted">Configure os canais de contato.</div>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-6 text-xs text-muted">
          <div>© 2026 <strong>A</strong>MBEBE CORP. Todos os direitos reservados.</div>
          <div className="flex flex-wrap gap-4">
            <Link href="/politica-de-suporte" className="transition hover:text-primary">
              Politica de suporte
            </Link>
            <Link href="/termos-de-uso" className="transition hover:text-primary">
              Termos de uso
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
