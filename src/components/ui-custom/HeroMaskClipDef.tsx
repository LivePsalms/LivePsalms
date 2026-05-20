/**
 * Hidden SVG def for the `hero-mask-clip` clipPath. Used by the home hero
 * masked image and by the NextDevotionHandoff pill. Mount in exactly one
 * place per render tree — Hero on the home route, MoodBoard on the detail
 * route. Both never mount together so no ID collision risk.
 */
export function HeroMaskClipDef() {
  return (
    <svg
      className="absolute -top-[999px] -left-[999px] w-0 h-0"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="hero-mask-clip" clipPathUnits="objectBoundingBox">
          <path d="M0.0998072 1H0.422076H0.749756C0.767072 1 0.774207 0.961783 0.77561 0.942675V0.807325C0.777053 0.743631 0.791844 0.731953 0.799059 0.734076H0.969813C0.996268 0.730255 1.00088 0.693206 0.999875 0.675159V0.0700637C0.999875 0.0254777 0.985045 0.00477707 0.977629 0H0.902473C0.854975 0 0.890448 0.138535 0.850165 0.138535H0.0204424C0.00408849 0.142357 0 0.180467 0 0.199045V0.410828C0 0.449045 0.0136283 0.46603 0.0204424 0.469745H0.0523086C0.0696245 0.471019 0.0735527 0.497877 0.0733523 0.511146V0.915605C0.0723903 0.983121 0.090588 1 0.0998072 1Z" />
        </clipPath>
      </defs>
    </svg>
  );
}
