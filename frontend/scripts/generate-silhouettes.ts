import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const PET_ASSETS_DIR = path.join(process.cwd(), "public/assets/pets");

async function generateSilhouettes() {
  try {
    const entries = await fs.readdir(PET_ASSETS_DIR, { withFileTypes: true });

    // 폴더만 필터링 (spritePetEgg.png 같은 최상위 파일 제외)
    const petFolders = entries.filter((entry) => entry.isDirectory());

    console.log(`Found ${petFolders.length} pet folders to process.`);

    for (const folder of petFolders) {
      const folderPath = path.join(PET_ASSETS_DIR, folder.name);
      const files = await fs.readdir(folderPath);

      const imageFiles = files.filter(
        (file) =>
          (file.endsWith(".png") || file.endsWith(".webp")) &&
          !file.includes("_silhouette"),
      );

      console.log(`\nProcessing folder: ${folder.name} (${imageFiles.length} images)`);

      for (const file of imageFiles) {
        const inputPath = path.join(folderPath, file);

        // 원본 확장자 추출
        const ext = path.extname(file); // .png 또는 .webp
        const baseName = file.replace(ext, "");
        const outputFile = `${baseName}_silhouette${ext}`;
        const outputPath = path.join(folderPath, outputFile);

        try {
          await fs.access(outputPath);
          console.log(`  Skipping: ${outputFile} (already exists)`);
          continue;
        } catch {
          // File doesn't exist, proceed with generation
        }

        console.log(`  Generating silhouette for ${file}...`);

        const metadata = await sharp(inputPath).metadata();

        const sharpInstance = sharp({
          create: {
            width: metadata.width || 128,
            height: metadata.height || 128,
            channels: 4,
            background: { r: 64, g: 64, b: 64, alpha: 0.4 },
          },
        }).composite([
          {
            input: inputPath,
            blend: "dest-in",
          },
        ]);

        // 원본 확장자에 맞춰서 변환
        if (ext === ".webp") {
          await sharpInstance.webp().toFile(outputPath);
        } else {
          await sharpInstance.png().toFile(outputPath);
        }

        console.log(`  Saved: ${outputFile}`);
      }
    }

    console.log("\nSuccessfully generated all silhouettes.");
  } catch (error) {
    console.error("Error generating silhouettes:", error);
    process.exit(1);
  }
}

generateSilhouettes();
