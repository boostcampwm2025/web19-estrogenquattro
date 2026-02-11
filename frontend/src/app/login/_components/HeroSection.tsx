import { Github, VideoOff, Computer, PawPrint, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

interface HeroSectionProps {
  onLogin: () => void;
}

export default function HeroSection({ onLogin }: HeroSectionProps) {
  const { t } = useTranslation("login");

  const features = [
    {
      label: t((r) => r.hero.features[0]),
      icon: VideoOff,
      color: "bg-amber-700",
    },
    {
      label: t((r) => r.hero.features[1]),
      icon: Computer,
      color: "bg-amber-800",
    },
    {
      label: t((r) => r.hero.features[2]),
      icon: PawPrint,
      color: "bg-amber-900",
    },
  ];

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#ffecb3]/40 to-white px-6 pt-12 dark:from-slate-900 dark:to-slate-950">
      <div className="relative z-10 mx-auto max-w-6xl space-y-16 text-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="font-display text-lg font-bold tracking-[0.1em] text-amber-600 uppercase sm:text-xl sm:tracking-[0.2em] dark:text-amber-400"
            >
              <span className="relative inline-block">
                {t((r) => r.hero.tagline1)}
                <motion.span
                  initial={{ opacity: 0, scale: 0, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    delay: 1.5,
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                  className="absolute -top-7 left-1/2 -translate-x-1/2 text-3xl"
                >
                  🌱
                </motion.span>
              </span>{" "}
              {t((r) => r.hero.tagline2)}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="font-display text-3xl leading-[1.2] font-extrabold tracking-tight text-amber-950 sm:text-5xl dark:text-white"
            >
              {t((r) => r.hero.title1)}
              <br />
              <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 bg-clip-text text-transparent">
                {t((r) => r.hero.title2)}
              </span>
            </motion.h1>
          </div>
        </div>

        {/* Feature Grid - Trendy Glassmorphism Style */}
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
              whileHover={{
                y: -15,
                transition: { duration: 0.3, ease: "easeOut" },
              }}
              className="group relative flex aspect-[9/10] flex-col overflow-hidden rounded-[3rem] border border-amber-900/5 bg-white/40 p-10 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="relative flex flex-1 items-center justify-center">
                <motion.div
                  animate={{
                    y: [0, -12, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.5,
                  }}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <feature.icon
                    size={80}
                    className="text-amber-700 dark:text-amber-400"
                    strokeWidth={1}
                  />
                </motion.div>

                {/* Decorative Glow behind icon */}
                <div className="absolute h-32 w-32 rounded-full bg-amber-500 opacity-20 blur-[80px]" />
              </div>

              {/* Label Section */}
              <div className="mt-6 text-left">
                <p className="font-display mb-2 text-xs font-bold tracking-[0.3em] text-amber-600 uppercase opacity-70">
                  Feature {i + 1}
                </p>
                <h3 className="font-display text-xl leading-tight font-extrabold tracking-tight text-amber-950 sm:text-2xl dark:text-white">
                  {feature.label}
                </h3>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="flex flex-col items-center justify-center gap-6 sm:flex-row"
        >
          <motion.button
            onClick={onLogin}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="pixel-button-2d font-display flex items-center gap-3 bg-amber-600 px-10 py-5 text-2xl font-bold text-white shadow-[6px_6px_0px_0px_rgba(120,53,15,0.3)] hover:bg-amber-500"
          >
            <Github className="h-6 w-6" />
            {t((r) => r.hero.loginButton)}
          </motion.button>
          <motion.button
            onClick={() => {
              document
                .getElementById("features-section")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="pixel-button-2d font-display flex items-center gap-2 border-2 border-amber-900/10 bg-white/50 px-10 py-5 text-xl font-bold text-amber-900 shadow-[6px_6px_0px_0px_rgba(120,53,15,0.1)] backdrop-blur-sm hover:bg-white/80"
          >
            {t((r) => r.hero.browseButton)}
            <ArrowRight className="h-5 w-5" />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
