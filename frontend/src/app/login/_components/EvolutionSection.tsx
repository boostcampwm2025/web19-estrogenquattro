import { Sparkles, Heart, TrendingUp } from "lucide-react";
import { motion } from "motion/react";

export default function EvolutionSection() {
  const features = [
    {
      icon: Sparkles,
      emoji: "🥚",
      title: "가챠",
      description: "랜덤으로 귀여운 펫을 뽑으세요!",
      color: "from-yellow-500 to-orange-500",
      textColor: "text-amber-600",
    },
    {
      icon: Heart,
      emoji: "🍖",
      title: "밥주기",
      description: "펫에게 포인트를 투자해 경험치를 쌓으세요.",
      color: "from-pink-500 to-red-500",
      textColor: "text-rose-600",
    },
    {
      icon: TrendingUp,
      emoji: "⭐",
      title: "진화",
      description: "최대 3단계까지! 펫도 강력해집니다.",
      color: "from-purple-500 to-indigo-500",
      textColor: "text-violet-600",
    },
  ];

  const pointSystem = [
    { action: "커밋 (Push)", points: "3P", icon: "💻" },
    { action: "PR 머지", points: "4P", icon: "🔀" },
    { action: "집중 30분", points: "1P", icon: "⏰" },
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
            몰입으로 펫을 성장시키세요!
          </h2>
          <p className="mx-auto max-w-2xl text-2xl text-slate-500 dark:text-slate-400">
            개발 활동(Commit, PR, Review)을 할 때마다 포인트가 쌓입니다.
            <br /> 쌓인 포인트로 무엇을 할 수 있냐고요?
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
            <h3 className="font-display mb-2 text-3xl font-bold">진화 예시</h3>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              펫은 최대 3단계까지 진화합니다
            </p>
          </div>

          {/* Evolution Line Display - Minimal Style */}
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-center gap-8">
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
                    src="/assets/pets/pet_docker_1.png"
                    alt="Docker 1단계"
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="text-sm font-bold text-amber-900">1단계</p>
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
                    src="/assets/pets/pet_docker_2.png"
                    alt="Docker 2단계"
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="text-sm font-bold text-amber-900">2단계</p>
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
                    src="/assets/pets/pet_docker_3.png"
                    alt="???"
                    className="pointer-events-none h-full w-full object-contain opacity-40 brightness-0 grayscale"
                  />
                </div>
                <p className="text-sm font-bold text-gray-500">???</p>
                <p className="text-xs text-gray-400">직접 확인해보세요!</p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
