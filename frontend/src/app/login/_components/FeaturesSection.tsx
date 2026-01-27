import { Github, BarChart3, Map } from "lucide-react";
import { motion } from "motion/react";

export default function FeaturesSection() {
  const features = [
    {
      icon: Github,
      title: "GitHub 활동 연동",
      description:
        "커밋(Push), PR, 이슈 생성과 같은 깃허브 활동을 감지합니다.<br>당신의 잔디가 캐릭터 이펙트로 즉시 나타납니다!",
      highlights: ["실시간 감지", "자동 동기화", "이펙트 효과"],

      src: "/assets/landing/feature1.jpg",
    },
    {
      icon: BarChart3,
      title: "개인 성취 시각화",
      description:
        "오늘 얼마나 집중했나요?<br>잔디/캘린더로 일별 활동을 기록하고, 태스크 완료를 한눈에 확인하세요.",
      highlights: ["일별 기록", "통계 분석", "성취도 표시"],
      src: "/assets/landing/feature2.jpg",
    },
    {
      icon: Map,
      title: "변화하는 가상 공간",
      description:
        "7일 시즌제로 운영되는 맵!<br> 공동의 목표가 달성되면 맵이 확장되고 성장합니다.",
      highlights: ["시즌제 운영", "맵 확장", "공동 목표"],
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
          개발자를 위한 완벽한 몰입 도구
        </h2>
        <motion.p
          className="mx-auto max-w-2xl text-xl font-light text-slate-500 dark:text-slate-400"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          세 가지 핵심 기능으로 당신의 코딩 생활을 변화시킵니다
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
                  alt={feature.src}
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
