"use client";

import { moduleClasses } from "../../core/cx";
import type { HomeContent } from "../../data/types";
import styles from "../../styles/HomeHeroBlock.module.css";
import { AgencyLink } from "../../ui/AgencyLink";
import { GridWrapper } from "../../ui/GridWrapper";
import { WebglBg } from "../../ui/WebglBg";
import { BeeBlock } from "../shared/BeeBlock";

const cx = moduleClasses(styles);

/** Source Home `HeroBlock` (line ~48145): info row + BeeBlock titles. */
export function HomeHeroBlock(props: HomeContent["hero"]) {
  const { titles, titlesReveal, indication, city, textAgency, textFormer, agencies } = props;
  return (
    <WebglBg isGridWrapper={false} index={0} currentPage="home" disablePlaneOverscan className={cx("heroBlock")}>
      <GridWrapper className={cx("heroBlock__top")}>
        <p className={cx("top__city")} dangerouslySetInnerHTML={{ __html: city }} />
        <p className={cx("top__star")}>*</p>
        <div className={cx("top__infos")}>
          <div>
            {textAgency.map((t, i) => (
              <div key={i} className={cx("infos__text")}>
                {i === 1 ? (
                  <div className={cx("wrapper")}>
                    <p>{t}</p>
                    {agencies[0]?.url ? <AgencyLink name={agencies[0].name} url={agencies[0].url} /> : null}
                  </div>
                ) : (
                  <p>{t}</p>
                )}
              </div>
            ))}
          </div>
          <div className={cx("infos__agencies")}>
            <div className={cx("agencies__text")}>{textFormer}</div>
            {agencies[1]?.url ? <AgencyLink name={agencies[1].name} url={agencies[1].url} /> : null}
          </div>
        </div>
      </GridWrapper>
      <BeeBlock titles={titles} titlesReveal={titlesReveal} indication={indication} />
    </WebglBg>
  );
}
