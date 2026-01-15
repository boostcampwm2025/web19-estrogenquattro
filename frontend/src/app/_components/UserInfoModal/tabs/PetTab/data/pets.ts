export interface PetDef {
  id: string;
  species: string; // 진화 종류 그룹핑 (e.g., "go", "docker", "java")
  stage: 1 | 2 | 3;
  name: string;
  description: string;
  image: string;
  maxExp: number;
}

export const PETS_DATA: PetDef[] = [
  // --- Go (Language) ---
  {
    id: "pet-basic-1",
    species: "go",
    stage: 1,
    name: "고퍼",
    description:
      "구글에서 온 귀여운 두더지입니다. 단순하고 명료한 코드를 좋아합니다.",
    image: "/assets/pets/pet_go_1.png",
    maxExp: 30,
  },
  {
    id: "pet-basic-2",
    species: "go",
    stage: 2,
    name: "고루틴",
    description:
      "매우 가볍고 빠릅니다. 수천 마리가 동시에 뛰어놀아도 지치지 않습니다.",
    image: "/assets/pets/pet_go_2.png",
    maxExp: 100,
  },
  {
    id: "pet-basic-3",
    species: "go",
    stage: 3,
    name: "고헌터",
    description:
      "메모리 관리에 통달했습니다. 사용하지 않는 자원을 포착해 정리합니다.",
    image: "/assets/pets/pet_go_3.png",
    maxExp: 0,
  },

  // --- Docker (Infrastructure) ---
  {
    id: "pet-dev-1",
    species: "docker",
    stage: 1,
    name: "도커",
    description:
      "넓은 바다를 꿈꾸는 아기 고래입니다. 컨테이너를 등에 지고 다닙니다.",
    image: "/assets/pets/pet_docker_1.png",
    maxExp: 30,
  },
  {
    id: "pet-dev-2",
    species: "docker",
    stage: 2,
    name: "컴포즈",
    description:
      "친구들과 함께 다니는 것을 좋아합니다. 조화로운 서비스를 구성합니다.",
    image: "/assets/pets/pet_docker_2.png",
    maxExp: 100,
  },
  {
    id: "pet-dev-3",
    species: "docker",
    stage: 3,
    name: "쿠버네티스",
    description:
      "거대한 클러스터의 선장입니다. 어떤 트래픽 파도가 쳐도 끄떡없습니다.",
    image: "/assets/pets/pet_docker_3.png",
    maxExp: 0,
  },

  // --- Java (Language) ---
  {
    id: "pet-health-1",
    species: "java",
    stage: 1,
    name: "자바콩",
    description: "따뜻한 커피 향이 나는 콩입니다. 어디서든 잘 자랍니다.",
    image: "/assets/pets/pet_java_1.png",
    maxExp: 30,
  },
  {
    id: "pet-health-2",
    species: "java",
    stage: 2,
    name: "스프링",
    description:
      "강력한 프레임워크를 입었습니다. 객체 주입을 받는 것을 좋아합니다.",
    image: "/assets/pets/pet_java_2.png",
    maxExp: 100,
  },
  {
    id: "pet-health-3",
    species: "java",
    stage: 3,
    name: "JVM",
    description: "가상 머신의 제왕입니다. 메모리 영역을 통제하며 군림합니다.",
    image: "/assets/pets/pet_java_3.png",
    maxExp: 0,
  },
];
