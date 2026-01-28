import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedPets9999999999999 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Go
    await queryRunner.query(
      `INSERT INTO "pets" ("species", "name", "description", "evolution_stage", "evolution_required_exp", "actual_img_url", "silhouette_img_url") VALUES 
      ('go', '고퍼', '구글에서 온 귀여운 두더지입니다. 단순하고 명료한 코드를 좋아합니다.', 1, 30, '/assets/pets/pet_go_1.png', '/assets/pets/pet_go_1_silhouette.png'),
      ('go', '고루틴', '매우 가볍고 빠릅니다. 수천 마리가 동시에 뛰어놀아도 지치지 않습니다.', 2, 100, '/assets/pets/pet_go_2.png', '/assets/pets/pet_go_2_silhouette.png'),
      ('go', '고헌터', '메모리 관리에 통달했습니다. 사용하지 않는 자원을 포착해 정리합니다.', 3, 0, '/assets/pets/pet_go_3.png', '/assets/pets/pet_go_3_silhouette.png')`,
    );

    // 2. Docker
    await queryRunner.query(
      `INSERT INTO "pets" ("species", "name", "description", "evolution_stage", "evolution_required_exp", "actual_img_url", "silhouette_img_url") VALUES 
      ('docker', '도커', '넓은 바다를 꿈꾸는 아기 고래입니다. 컨테이너를 등에 지고 다닙니다.', 1, 30, '/assets/pets/pet_docker_1.png', '/assets/pets/pet_docker_1_silhouette.png'),
      ('docker', '컴포즈', '친구들과 함께 다니는 것을 좋아합니다. 조화로운 서비스를 구성합니다.', 2, 100, '/assets/pets/pet_docker_2.png', '/assets/pets/pet_docker_2_silhouette.png'),
      ('docker', '쿠버네티스', '거대한 클러스터의 선장입니다. 어떤 트래픽 파도가 쳐도 끄떡없습니다.', 3, 0, '/assets/pets/pet_docker_3.png', '/assets/pets/pet_docker_3_silhouette.png')`,
    );

    // 3. Java
    await queryRunner.query(
      `INSERT INTO "pets" ("species", "name", "description", "evolution_stage", "evolution_required_exp", "actual_img_url", "silhouette_img_url") VALUES 
      ('java', '자바콩', '따뜻한 커피 향이 나는 콩입니다. 어디서든 잘 자랍니다.', 1, 30, '/assets/pets/pet_java_1.png', '/assets/pets/pet_java_1_silhouette.png'),
      ('java', '스프링', '강력한 프레임워크를 입었습니다. 객체 주입을 받는 것을 좋아합니다.', 2, 100, '/assets/pets/pet_java_2.png', '/assets/pets/pet_java_2_silhouette.png'),
      ('java', 'JVM', '가상 머신의 제왕입니다. 메모리 영역을 통제하며 군림합니다.', 3, 0, '/assets/pets/pet_java_3.png', '/assets/pets/pet_java_3_silhouette.png')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "pets" WHERE "species" IN ('go', 'docker', 'java')`,
    );
  }
}
