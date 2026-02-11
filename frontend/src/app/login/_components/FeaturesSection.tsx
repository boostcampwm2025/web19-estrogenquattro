import { Github, BarChart3, Map as MapIcon } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

export default function FeaturesSection() {
  const { t } = useTranslation("login");

  const features = [
    {
      icon: Github,
      title: t((r) => r.features.items[0].title),
      description: t((r) => r.features.items[0].description),
      highlights: [
        t((r) => r.features.items[0].highlights[0]),
        t((r) => r.features.items[0].highlights[1]),
        t((r) => r.features.items[0].highlights[2]),
      ],
      src: "/assets/landing/feature1.jpg",
    },
    {
      icon: BarChart3,
      title: t((r) => r.features.items[1].title),
      description: t((r) => r.features.items[1].description),
      highlights: [
        t((r) => r.features.items[1].highlights[0]),
        t((r) => r.features.items[1].highlights[1]),
        t((r) => r.features.items[1].highlights[2]),
      ],
      src: "/assets/landing/feature2.jpg",
    },
    {
      icon: MapIcon,
      title: t((r) => r.features.items[2].title),
      description: t((r) => r.features.items[2].description),
      highlights: [
        t((r) => r.features.items[2].highlights[0]),
        t((r) => r.features.items[2].highlights[1]),
        t((r) => r.features.items[2].highlights[2]),
      ],
      src: "/assets/landing/feature3.gif",
    },
  ];

  return (
    <section
      id="features-section"
      className="mx-auto max-w-7xl overflow-hidden px-6 py-32"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="mb-20 space-y-4 text-center"
      >
        <h2 className="font-display text-3xl tracking-tight sm:text-5xl">
          {t((r) => r.features.heading)}
        </h2>
        <motion.p
          className="mx-auto max-w-2xl text-xl font-light text-slate-500 dark:text-slate-400"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          {t((r) => r.features.subheading)}
        </motion.p>
      </motion.div>

      <div className="space-y-32">
        {features.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: index % 2 === 0 ? -100 : 100 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
            className={`flex flex-col items-center gap-12 ${
              index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
            }`}
          >
            {/* Image Side */}
            <div className="w-full lg:w-1/2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className={`relative aspect-video overflow-hidden rounded-2xl shadow-2xl`}
              >
                <img
                  src={feature.src}
                  alt={feature.title}
                  className="h-full w-full object-cover"
                />
              </motion.div>
            </div>

            {/* Content Side */}
            <div className="w-full space-y-8 lg:w-1/2">
              <div className="flex items-center space-x-4">
                <feature.icon className="h-8 w-8 text-black" />
                <h3 className="font-display text-2xl sm:text-4xl">
                  {feature.title}
                </h3>
              </div>

              <p className="text-xl leading-relaxed text-slate-500 dark:text-slate-400">
                {feature.description.split("<br>").map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < feature.description.split("<br>").length - 1 && <br />}
                  </span>
                ))}
              </p>

              {/* Highlights Chips */}
              <div className="flex flex-wrap gap-3">
                {feature.highlights.map((highlight, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 + i * 0.1, type: "spring" }}
                    className="border-retro-border-light bg-retro-bg-secondary/30 px-3 py-1 text-sm font-bold text-slate-600 dark:text-slate-300"
                  >
                    #{highlight}
                  </motion.span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
