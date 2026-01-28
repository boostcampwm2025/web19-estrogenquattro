import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const PET_ASSETS_DIR = path.join(process.cwd(), "public/assets/pets");

async function generateSilhouettes() {
  try {
    const files = await fs.readdir(PET_ASSETS_DIR);
    const pngFiles = files.filter(
      (file) =>
        file.endsWith(".png") &&
        !file.endsWith("_silhouette.png") &&
        file !== "spritePetEgg.png",
    );

    console.log(`Found ${pngFiles.length} pet images to process.`);

    for (const file of pngFiles) {
      const inputPath = path.join(PET_ASSETS_DIR, file);
      const outputFile = file.replace(".png", "_silhouette.png");
      const outputPath = path.join(PET_ASSETS_DIR, outputFile);

      try {
        await fs.access(outputPath);
        console.log(`Skipping: ${outputFile} (already exists)`);
        continue;
      } catch {
        // File doesn't exist, proceed with generation
      }

      console.log(`Generating silhouette for ${file}...`);

      const metadata = await sharp(inputPath).metadata();

      await sharp({
        create: {
          width: metadata.width || 128,
          height: metadata.height || 128,
          channels: 4,
          background: { r: 64, g: 64, b: 64, alpha: 0.4 },
        },
      })
        .composite([
          {
            input: inputPath,
            blend: "dest-in",
          },
        ])
        .png()
        .toFile(outputPath);

      console.log(`Saved: ${outputFile}`);
    }

    console.log("Successfully generated all silhouettes.");
  } catch (error) {
    console.error("Error generating silhouettes:", error);
    process.exit(1);
  }
}

generateSilhouettes();
