import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedPets9999999999999 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Go
    await queryRunner.query(
      `INSERT INTO "pets" ("species", "name", "description", "evolution_stage", "evolution_required_exp", "actual_img_url", "silhouette_img_url") VALUES
      ('go', '고퍼', '구글에서 온 귀여운 두더지입니다. 단순하고 명료한 코드를 좋아합니다.', 1, 30, '/assets/pets/go/pet_go_1.webp', '/assets/pets/go/pet_go_1_silhouette.webp'),
      ('go', '고루틴', '매우 가볍고 빠릅니다. 수천 마리가 동시에 뛰어놀아도 지치지 않습니다.', 2, 100, '/assets/pets/go/pet_go_2.webp', '/assets/pets/go/pet_go_2_silhouette.webp'),
      ('go', '고헌터', '메모리 관리에 통달했습니다. 사용하지 않는 자원을 포착해 정리합니다.', 3, 0, '/assets/pets/go/pet_go_3.webp', '/assets/pets/go/pet_go_3_silhouette.webp')`,
    );

    // 2. Whale
    await queryRunner.query(
      `INSERT INTO "pets" ("species", "name", "description", "evolution_stage", "evolution_required_exp", "actual_img_url", "silhouette_img_url") VALUES
      ('whale', '웨일리', '넓은 바다를 꿈꾸는 아기 고래입니다. 귀여운 분수를 뿜습니다.', 1, 30, '/assets/pets/whale/pet_whale_1.webp', '/assets/pets/whale/pet_whale_1_silhouette.webp'),
      ('whale', '오션', '깊은 바다를 탐험합니다. 우아한 움직임으로 물살을 가릅니다.', 2, 100, '/assets/pets/whale/pet_whale_2.webp', '/assets/pets/whale/pet_whale_2_silhouette.webp'),
      ('whale', '리바이어던', '바다의 전설입니다. 거대한 파도를 일으키며 대양을 지배합니다.', 3, 0, '/assets/pets/whale/pet_whale_3.webp', '/assets/pets/whale/pet_whale_3_silhouette.webp')`,
    );

    // 3. Java
    await queryRunner.query(
      `INSERT INTO "pets" ("species", "name", "description", "evolution_stage", "evolution_required_exp", "actual_img_url", "silhouette_img_url") VALUES
      ('java', '자바콩', '따뜻한 커피 향이 나는 콩입니다. 어디서든 잘 자랍니다.', 1, 30, '/assets/pets/java/pet_java_1.webp', '/assets/pets/java/pet_java_1_silhouette.webp'),
      ('java', '스프링', '강력한 프레임워크를 입었습니다. 객체 주입을 받는 것을 좋아합니다.', 2, 100, '/assets/pets/java/pet_java_2.webp', '/assets/pets/java/pet_java_2_silhouette.webp'),
      ('java', 'JVM', '가상 머신의 제왕입니다. 메모리 영역을 통제하며 군림합니다.', 3, 0, '/assets/pets/java/pet_java_3.webp', '/assets/pets/java/pet_java_3_silhouette.webp')`,
    );

    // 4. Android
    await queryRunner.query(
      `INSERT INTO "pets" ("species", "name", "description", "evolution_stage", "evolution_required_exp", "actual_img_url", "silhouette_img_url") VALUES
      ('android', '버그드로이드', '귀여운 초록색 로봇입니다. 오픈소스 정신을 품고 있습니다.', 1, 30, '/assets/pets/android/pet_android_1.webp', '/assets/pets/android/pet_android_1_silhouette.webp'),
      ('android', '젯팩', '최신 라이브러리로 무장했습니다. 생명주기를 완벽하게 관리합니다.', 2, 100, '/assets/pets/android/pet_android_2.webp', '/assets/pets/android/pet_android_2_silhouette.webp'),
      ('android', '머티리얼', '세련된 디자인을 구현합니다. 수십억 사용자의 손 안에서 빛납니다.', 3, 0, '/assets/pets/android/pet_android_3.webp', '/assets/pets/android/pet_android_3_silhouette.webp')`,
    );

    // 5. KDE
    await queryRunner.query(
      `INSERT INTO "pets" ("species", "name", "description", "evolution_stage", "evolution_required_exp", "actual_img_url", "silhouette_img_url") VALUES
      ('kde', '콘키', '귀여운 초록색 드래곤입니다. 자유로운 데스크톱 환경을 꿈꿉니다.', 1, 30, '/assets/pets/kde/pet_kde_1.webp', '/assets/pets/kde/pet_kde_1_silhouette.webp'),
      ('kde', '플라즈마', '유려한 UI로 진화했습니다. 커스터마이징의 달인입니다.', 2, 100, '/assets/pets/kde/pet_kde_2.webp', '/assets/pets/kde/pet_kde_2_silhouette.webp'),
      ('kde', '크렌더', '완벽한 데스크톱 경험을 제공합니다. 모든 위젯을 다룰 수 있습니다.', 3, 0, '/assets/pets/kde/pet_kde_3.webp', '/assets/pets/kde/pet_kde_3_silhouette.webp')`,
    );

    // 6. Linux
    await queryRunner.query(
      `INSERT INTO "pets" ("species", "name", "description", "evolution_stage", "evolution_required_exp", "actual_img_url", "silhouette_img_url") VALUES
      ('linux', '턱스', '귀여운 펭귄입니다. 커널의 힘을 품고 있습니다.', 1, 30, '/assets/pets/linux/pet_linux_1.webp', '/assets/pets/linux/pet_linux_1_silhouette.webp'),
      ('linux', '시스템디', '모든 프로세스를 관장합니다. 부팅 시간을 단축시키는 능력이 있습니다.', 2, 100, '/assets/pets/linux/pet_linux_2.webp', '/assets/pets/linux/pet_linux_2_silhouette.webp'),
      ('linux', '리눅스 토발즈', '오픈소스 세상의 전설입니다. 전 세계 서버를 지배합니다.', 3, 0, '/assets/pets/linux/pet_linux_3.webp', '/assets/pets/linux/pet_linux_3_silhouette.webp')`,
    );

    // 7. Rust
    await queryRunner.query(
      `INSERT INTO "pets" ("species", "name", "description", "evolution_stage", "evolution_required_exp", "actual_img_url", "silhouette_img_url") VALUES
      ('rust', '페리스', '귀여운 빨간 게입니다. 메모리 안전성을 보장합니다.', 1, 30, '/assets/pets/rust/pet_rust_1.webp', '/assets/pets/rust/pet_rust_1_silhouette.webp'),
      ('rust', '보로우 체커', '소유권 시스템의 수호자입니다. 컴파일 타임에 버그를 잡아냅니다.', 2, 100, '/assets/pets/rust/pet_rust_2.webp', '/assets/pets/rust/pet_rust_2_silhouette.webp'),
      ('rust', '제로 코스트', '추상화의 완성체입니다. C++만큼 빠르지만 훨씬 안전합니다.', 3, 0, '/assets/pets/rust/pet_rust_3.webp', '/assets/pets/rust/pet_rust_3_silhouette.webp')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "pets" WHERE "species" IN ('go', 'whale', 'java', 'android', 'kde', 'linux', 'rust')`,
    );
  }
}
