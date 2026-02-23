import Image from "next/image";

import styles from "./media-stack.module.css";

const IMAGE_1 = "/images/google-drive-sync-laptop.webp";
const IMAGE_2 = "/images/explore.webp";

export function MediaStack() {
  return (
    <div className={styles.stack}>
      <div className={styles.mediaOne}>
        <Image
          src={IMAGE_1}
          alt="CanonCore item detail page with cinematic metadata"
          width={1440}
          height={900}
          sizes="(max-width: 1024px) 70vw, 50vw"
          priority
          className={styles.mediaInner}
        />
      </div>
      <div className={styles.mediaTwo}>
        <Image
          src={IMAGE_2}
          alt="CanonCore explore page with public collections"
          width={1440}
          height={900}
          sizes="(max-width: 1024px) 70vw, 50vw"
          loading="eager"
          className={styles.mediaInner}
        />
      </div>
    </div>
  );
}
