import { Sparkles, Heart, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

export default function EvolutionSection() {
  const { t } = useTranslation("login");

  const features = [
    {
      icon: Sparkles,
      emoji: "🐣",
      title: t((r) => r.evolution.cards[0].title),
      description: t((r) => r.evolution.cards[0].description),
      color: "from-yellow-500 to-orange-500",
      textColor: "text-amber-600",
    },
    {
      icon: Heart,
      emoji: "🍖",
      title: t((r) => r.evolution.cards[1].title),
      description: t((r) => r.evolution.cards[1].description),
      color: "from-pink-500 to-red-500",
      textColor: "text-rose-600",
    },
    {
      icon: TrendingUp,
      emoji: "⭐",
      title: t((r) => r.evolution.cards[2].title),
      description: t((r) => r.evolution.cards[2].description),
      color: "from-purple-500 to-indigo-500",
      textColor: "text-violet-600",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const } },
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/20">
      {/* 1. Feature Cards Section */}
      <section className="mx-auto max-w-7xl px-6 py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <h2 className="font-display mb-6 text-4xl leading-tight sm:text-5xl">
            {t((r) => r.evolution.heading)}
          </h2>
          <p className="mx-auto max-w-2xl text-2xl text-slate-500 dark:text-slate-400">
            {t((r) => r.evolution.subheading1)}
            <br />
            {t((r) => r.evolution.subheading2)}
          </p>
        </motion.div>

        {/* Feature Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="mb-24 grid grid-cols-1 gap-8 md:grid-cols-3"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ y: -10 }}
              className="group relative overflow-hidden"
            >
              <div className="border-retro-border-light bg-background/50 relative h-full p-8 backdrop-blur-sm transition-shadow hover:shadow-xl">
                <div
                  className={`bg-gradient-to-br ${feature.color} absolute inset-0 opacity-0 transition-opacity group-hover:opacity-10`}
                />

                <div className="relative z-10 text-center">
                  <div className="mb-6 inline-block">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg dark:bg-slate-800">
                      <span className="text-5xl">{feature.emoji}</span>
                    </div>
                  </div>
                  <h3 className="mb-3 text-2xl font-bold">{feature.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* 진화 예시 이미지 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mt-20"
        >
          <div className="mb-12 text-center">
            <h3 className="font-display mb-2 text-3xl font-bold">
              {t((r) => r.evolution.example.heading)}
            </h3>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              {t((r) => r.evolution.example.subheading)}
            </p>
          </div>

          {/* Evolution Line Display - Minimal Style */}
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col items-center justify-center gap-8 sm:flex-row">
              {/* Stage 1 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, type: "spring" }}
                className="flex flex-col items-center gap-2"
              >
                <div className="relative h-32 w-32">
                  <img
                    src="/assets/pets/whale/pet_whale_1.webp"
                    alt="Whale Stage 1"
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="text-sm font-bold text-amber-900">
                  {t((r) => r.evolution.example.stage, { n: 1 })}
                </p>
              </motion.div>

              {/* Arrow 1 */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="text-4xl text-amber-900/60"
              >
                ▶
              </motion.div>

              {/* Stage 2 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, type: "spring" }}
                className="flex flex-col items-center gap-2"
              >
                <div className="relative h-32 w-32">
                  <img
                    src="/assets/pets/whale/pet_whale_2.webp"
                    alt="Whale Stage 2"
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="text-sm font-bold text-amber-900">
                  {t((r) => r.evolution.example.stage, { n: 2 })}
                </p>
              </motion.div>

              {/* Arrow 2 */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="text-4xl text-amber-900/60"
              >
                ▶
              </motion.div>

              {/* Stage 3 - Silhouette */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, type: "spring" }}
                className="flex flex-col items-center gap-2"
              >
                <div className="relative h-32 w-32">
                  <img
                    src="/assets/pets/whale/pet_whale_3_silhouette.webp"
                    alt="Whale Stage 3 Secret"
                    className="pointer-events-none h-full w-full object-contain"
                  />
                </div>
                <p className="text-sm font-bold text-gray-500">???</p>
                <p className="text-xs text-gray-400">
                  {t((r) => r.evolution.example.secret)}
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
