// src/components/sections/MoodBoard.tsx
import { useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/all';
import { useIsMobile } from '@/hooks/use-mobile';
import { categoryLabel, projects } from '@/data/projects';
import { PhotoDevelopImage } from '@/components/ui-custom/PhotoDevelopImage';
import { NewsletterDialog } from '@/components/sections/NewsletterDialog';
import type { Project } from '@/types';

gsap.registerPlugin(ScrollTrigger);

/* ── Shared CTA used by every Zone 7 (Continue Restoring …) ── */
type RestorationCTAProps = {
  purposeWord: string;
  overlayColor: string;
};

function RestorationCTA({ purposeWord, overlayColor }: RestorationCTAProps) {
  return (
    <div
      className="relative flex-shrink-0 h-screen flex items-center justify-center"
      style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${overlayColor} 95%, black 10%)` }}
    >
      <div className="flex flex-col items-center text-center max-w-lg px-8">
        <h3
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[1.15] mb-6"
          style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
        >
          Continue Restoring Your {purposeWord}
        </h3>
        <p className="text-sm text-white/50 tracking-wide leading-relaxed mb-8">
          Take a few moments to pause, reflect, and jot down what God is revealing to you.
        </p>
        <Link
          to="/notepad"
          className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-full border border-white/30 bg-white/5 text-sm text-white/95 tracking-wide hover:bg-white/10 hover:border-white/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 mt-2"
        >
          Open your notepad
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-[3px] motion-reduce:transform-none"
          >
            →
          </span>
        </Link>
        <p className="mt-6 text-xs text-white/40 tracking-wide">
          Or{' '}
          <NewsletterDialog>
            <button
              type="button"
              className="underline underline-offset-4 decoration-white/30 text-white/70 hover:text-white hover:decoration-white/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-sm"
            >
              join the newsletter
            </button>
          </NewsletterDialog>
        </p>
      </div>
    </div>
  );
}

/* ── Trust (serenity5) image map — filenames preserved as authored ── */
const T = {
  hero: '/serenity5/IMG_3096.jpg',
  hookLeft: '/serenity5/IMG_3135.jpg',
  hookRight: '/serenity5/IMG_3136.jpg',
  scripture1: '/serenity5/hf_20260503_234251_3f56432b-dfda-4ad8-9d48-ca863023bcf7.png',
  scripture2: '/serenity5/hf_20260503_234258_eef0f2e5-d23e-49f3-b4fc-35b0e5656e4e.png',
  scripture3: '/serenity5/hf_20260503_235715_5a8db31c-6ea8-49ab-9408-f85f4c166cbb.png',
  principle1: '/serenity5/hf_20260503_235857_64c6eb21-2eb5-4ec4-a44f-fad4abb52e92.png',
  principle2: '/serenity5/hf_20260504_052134_398fd85d-0d00-44c9-a1f9-981ca3154bf4.png',
  principle3: '/serenity5/hf_20260504_052436_557939ec-87e0-4673-b4a1-c8d3775201f7.png',
  application1: '/serenity5/hf_20260504_195637_36b88230-f7cc-4e8d-9daa-35cc8e416ad7.png',
  application2: '/serenity5/hf_20260504_195644_c49ef0b9-8d32-494f-a4d4-f02484201831.png',
  application3: '/serenity5/hf_20260504_195806_6241875a-1034-4fe4-bf5c-90439a29804f.png',
  prayer: '/serenity5/hf_20260504_200030_b5f11ae6-25e4-448d-af8a-72e1de4f3cd7.png',
  closing: '/serenity5/hf_20260504_200042_109971c7-9c69-4914-b977-a98e17bcd18b.png',
};

/* ── Surrender (serenity3) image map — hash filenames preserved as authored ── */
const Su = {
  hero: '/serenity3/hf_20260417_220039_093609a2-929e-4c7f-9cc7-a61440c6a2fa.png',
  hookLeft: '/serenity3/hf_20260418_213303_2c7208e9-a034-4456-9a9f-da42dba4900e.png',
  hookRight: '/serenity3/hf_20260503_210659_6a1c5433-4ad6-4513-8ee5-07aa6d2ff55c.png',
  scripture1: '/serenity3/hf_20260503_211252_83c86a1b-fa20-456c-8419-3449c1fdf14b.png',
  scripture2: '/serenity3/hf_20260503_212601_05bebb34-1f95-42c9-bc30-49cecf97aeab.png',
  scripture3: '/serenity3/hf_20260503_212827_b4ef4c61-b7e4-4cb2-9753-0672c8c1700b.png',
  principle1: '/serenity3/hf_20260503_212955_5cdf0cc4-20b4-4709-bccb-439de6b1872b.png',
  principle2: '/serenity3/hf_20260503_212959_2b175f35-39d4-47ca-97d6-befe7c47a7a7.png',
  principle3: '/serenity3/hf_20260503_213117_34d23e3c-edea-4222-b8d5-e90281b8dfe9.png',
  application1: '/serenity3/hf_20260503_213134_7f564fd0-ed51-49ab-86b3-57706efe5699.png',
  application2: '/serenity3/hf_20260503_213652_ebf66dbf-1b27-40cd-92ee-44adf241c584.png',
  application3: '/serenity3/hf_20260503_224132_d797566b-9e26-4281-a0c3-3fa97888bc26.png',
  prayer: '/serenity3/hf_20260503_224542_44fc23d7-5722-41d8-addd-580c38dc133f.png',
  closing: '/serenity3/hf_20260503_224737_80817433-59dd-4332-a2a1-99db143a5cc5.png',
};

/* ── Forgiveness (serenity2) image map — hash filenames preserved as authored ── */
const F = {
  hero: '/serenity2/hf_20260417_180057_acab57fb-74d9-469f-b29b-a1b8af56ccd9.png',
  hookLeft: '/serenity2/hf_20260417_185222_2006ffa5-d241-46ab-95d8-ea9fa7b22bc6.png',
  hookRight: '/serenity2/hf_20260417_210451_81d36918-c70b-4d80-8f5c-a90febb338db.png',
  scripture1: '/serenity2/hf_20260417_211444_9529204a-d9a3-41e0-9c8a-2ef0b9dc041a.png',
  scripture2: '/serenity2/hf_20260417_212151_41d47271-4ac4-440c-a433-b8f3d4975a72.png',
  scripture3: '/serenity2/hf_20260417_212321_79c2d74f-6e30-4cce-88f8-69fe676a97af.png',
  principle1: '/serenity2/hf_20260417_212414_ef2e2e0d-2605-401e-bd0e-d24ac094815e.png',
  principle2: '/serenity2/hf_20260417_212558_184282cb-d6e3-4e51-82d8-6114cb23762d.png',
  principle3: '/serenity2/hf_20260502_085359_63722552-4e69-444b-8d3a-7f081ef72c6a.png',
  application1: '/serenity2/hf_20260502_085518_7f633410-3d8a-4f18-86ba-197245d5afe4.png',
  application2: '/serenity2/hf_20260502_085857_a46a594d-1d82-4042-b0da-2ed1be676826.png',
  application3: '/serenity2/hf_20260502_085911_315d48f9-a4e9-47f4-8a19-0440dd6c4152.png',
  prayer: '/serenity2/hf_20260502_085916_c6a51648-3fd1-4aa8-b43d-28886b87440a.png',
  closing: '/serenity2/hf_20260502_085928_fcb17da2-4d4d-4a8f-abb7-8340acfa0435.png',
};

/* ── Joy (restoration10) image map — hash filenames preserved as authored ── */
const J = {
  hero: '/restoration10/hf_20260417_160036_8cfcbbb9-be3c-41e1-90be-3a356eb8955c.png',
  hookLeft: '/restoration10/hf_20260417_160342_b426e452-1743-40ff-b739-089f5f1e59e4.png',
  hookRight: '/restoration10/hf_20260417_161445_d7a1bff7-ffb7-48fe-bc41-a67e4712319b.png',
  scripture1: '/restoration10/hf_20260417_161709_3d94e62d-3112-4db0-93cd-a8e06d8f7376.png',
  scripture2: '/restoration10/hf_20260417_162007_2bea4cf3-9b4b-4886-946f-06536f464d08.png',
  scripture3: '/restoration10/hf_20260417_165704_e7b2ba90-c2ee-47f2-a57c-2975e747b8cf.png',
  principle1: '/restoration10/hf_20260417_170545_fb1ef716-8275-4ba1-99c4-7f1a9262d680.png',
  principle2: '/restoration10/hf_20260502_013116_95da236a-b587-42d8-a38a-997e28331415.png',
  principle3: '/restoration10/hf_20260502_013119_28d06366-03f0-4f4f-8dcb-749ff44e4bc2.png',
  application1: '/restoration10/hf_20260502_013411_c6aa1e17-c02e-484b-96da-e553e559d225.png',
  application2: '/restoration10/hf_20260502_013636_fc7d80bf-5d20-46f9-8f72-26f5d82f1d8e.png',
  application3: '/restoration10/hf_20260424_202713_1125e681-9649-4065-bcfb-da5f11a7ae3c.png',
  prayer: '/restoration10/hf_20260502_080118_326dd430-55e2-47ff-b2be-50dd32a716b4.png',
  closing: '/restoration10/hf_20260502_080731_5176b83e-1a0a-4199-b6b6-c708dabb0cea.png',
};

/* ── Identity (restoration9) image map — hash filenames preserved as authored ── */
const I = {
  hero: '/restoration9/hf_20260417_004042_2d78afd9-82c6-447b-93e1-d4df054daedf.png',
  hookLeft: '/restoration9/hf_20260417_004334_cd8d309f-b30a-479c-91a1-38b7c0b6fd99.png',
  hookRight: '/restoration9/hf_20260417_004454_f57f28f0-4657-4711-bdfd-c1d58dc83c88.png',
  scripture1: '/restoration9/hf_20260417_005250_c48fad4a-a8ae-469d-9dff-8f2e64035c58.png',
  scripture2: '/restoration9/hf_20260417_005635_c4867a6e-a71b-410f-a7a9-39f112a2603c.png',
  scripture3: '/restoration9/hf_20260417_011524_8824205f-faff-4afa-82bf-eab7284acbcc.png',
  principle1: '/restoration9/hf_20260501_005610_3a820135-6195-4a39-b5d5-80fb493ca0a0.png',
  principle2: '/restoration9/hf_20260501_010534_4a47a0c3-cfe9-4567-9173-8296719d3c1a.png',
  principle3: '/restoration9/hf_20260501_042519_f0fa2f6c-27c6-4524-a10a-2e128544249c.png',
  application1: '/restoration9/hf_20260501_060719_1ea6ca87-9a7e-4878-98d2-a34963451185.png',
  application2: '/restoration9/hf_20260501_231905_79616caf-5a25-464d-8c7f-4a29e2f20d19.png',
  application3: '/restoration9/hf_20260501_232632_a9b6641f-4be0-4da8-88e0-a9f64657bf01.png',
  prayer: '/restoration9/hf_20260502_010507_ba5ab2bc-9f2b-43fa-bb1c-f05ae7b7adef.png',
  closing: '/restoration9/hf_20260502_010513_b61077b3-40ef-48da-bdbc-7d334054a5c1.png',
};

/* ── Connection (restoration8) image map — hash filenames preserved as authored ── */
const C = {
  hero: '/restoration8/hf_20260416_074854_c5387c7f-6f07-4b15-bf62-4afdddee9149.png',
  hookLeft: '/restoration8/hf_20260416_195643_015d73a3-67df-4a69-9ad8-6f77d45e1cc8.png',
  hookRight: '/restoration8/hf_20260416_201556_e9918730-9f10-4bd7-ac55-28573f4f5e0c.png',
  scripture1: '/restoration8/hf_20260416_214154_f9197cf0-dad3-451e-9fca-55f30abb7207.png',
  scripture2: '/restoration8/hf_20260416_234232_a782f6b7-6840-445b-b011-430d273c6dbf.png',
  scripture3: '/restoration8/hf_20260416_234755_bb74295d-f794-4b96-a325-8325f1e2e21f.png',
  principle1: '/restoration8/hf_20260416_235046_dcaa71cc-b08e-4fe3-bf27-1e5d67a9faa7.png',
  principle2: '/restoration8/hf_20260417_000744_c7a99951-4d03-4f24-a388-b078c87c4378.png',
  principle3: '/restoration8/hf_20260425_010526_4671b4b9-4c6c-4f63-aeb3-b4bd7cc2b9ea.png',
  application1: '/restoration8/hf_20260425_010846_2917ac8b-0653-416e-98b8-d9570990f1d7.png',
  application2: '/restoration8/hf_20260425_061517_398527bb-bda4-4eed-ba0c-4fc2dc5e0daa.png',
  application3: '/restoration8/hf_20260425_200331_6689ba50-acae-4ea7-964e-507fe77441ed.png',
  prayer: '/restoration8/hf_20260427_015402_dc843ba6-ab87-47d1-b314-30ff86531480.png',
  closing: '/restoration8/hf_20260427_020239_67d9168d-725c-4442-815b-a5634244125f.png',
};

/* ── Purpose (restoration7) image map — hash filenames preserved as authored ── */
const P = {
  hero: '/restoration7/hf_20260415_190342_341ba0fb-3636-4645-aa20-40f7c56ecf5c.png',
  hookLeft: '/restoration7/hf_20260416_064731_22fb4afb-4e63-4379-abef-96acc59a5670.png',
  hookRight: '/restoration7/hf_20260416_070309_7bc88c2a-8b61-45bb-8f06-0b0f971570b2.png',
  scripture1: '/restoration7/hf_20260416_071506_2111840c-d053-4190-b428-0208a1c30f2c.png',
  scripture2: '/restoration7/hf_20260416_071544_9c8f9c5b-6a58-4f49-babb-c7ef76834478.png',
  scripture3: '/restoration7/hf_20260416_072744_90bc91ef-7ad6-4cdf-8316-fd216b5fdada.png',
  principle1: '/restoration7/hf_20260424_195608_12a72225-2d69-48e8-941f-b0fcf617f9fc.png',
  principle2: '/restoration7/hf_20260424_203154_95194a66-1867-4cd1-86fd-3d3b345047c1.png',
  principle3: '/restoration7/hf_20260424_203247_ad629581-e993-4cae-9039-7faacb786d86.png',
  application1: '/restoration7/hf_20260424_203428_5f629add-9aba-4535-af57-faf03aee14d9.png',
  application2: '/restoration7/hf_20260424_203843_58e19d09-c2b8-459c-893c-3b611752f7ca.png',
  application3: '/restoration7/hf_20260424_203937_c76b655e-dc8d-48cf-9af1-43b580f9e054.png',
  prayer: '/restoration7/hf_20260424_204928_6beb6487-8f23-4b65-8f23-733d706d309d.png',
  closing: '/restoration7/hf_20260424_205550_4e748731-b0bb-4457-be6e-b6891ad06bce.png',
};

/* ── Wholeness (restoration6) image map — hash filenames preserved as authored ── */
const W = {
  hero: '/restoration6/hf_20260414_231106_4132533c-178d-4385-a431-2def24758ac8.png',
  hookLeft: '/restoration6/hf_20260414_233247_67c86046-3081-43e4-8fd2-22035aa30a55.png',
  hookRight: '/restoration6/hf_20260414_234114_46a4b300-ba2c-471b-8949-4a4d8e23b74a.png',
  scripture1: '/restoration6/hf_20260415_054031_db02be36-4c89-4222-9c51-cdf5bb36136a.png',
  scripture2: '/restoration6/hf_20260415_055252_fdb27a18-6f29-4f2c-8580-f042a3c9be7b.png',
  scripture3: '/restoration6/hf_20260415_055335_1322b651-3288-4fa8-8992-e262f9c9b745.png',
  principle1: '/restoration6/hf_20260415_060619_127522a4-5ed7-450d-b74a-45142a1e37b7.png',
  principle2: '/restoration6/hf_20260415_060715_0cbc7fcb-5dea-4bbf-9259-5593f0efe53d.png',
  principle3: '/restoration6/hf_20260415_061227_61d807e8-0881-4869-a4f5-cd2249a83f21.png',
  application1: '/restoration6/hf_20260423_214546_cc8117a5-3beb-481b-9d34-50562700a165.png',
  application2: '/restoration6/hf_20260423_221822_470ed8d3-2e93-448b-a218-4199a5c29d0e.png',
  application3: '/restoration6/hf_20260423_222545_997ab4b3-0907-4a4f-b8d7-13674a9f0bd8.png',
  prayer: '/restoration6/hf_20260423_222700_af42d740-e95b-41d9-9aa5-a60229e96638.png',
  closing: '/restoration6/hf_20260423_223100_2f270562-d148-45cc-8a74-8c470ae566a5.png',
};

/* ── Strength (restoration5) image map — hash filenames preserved as authored ── */
const S = {
  hero: '/restoration5/hf_20260414_210624_51692a60-f0b4-4235-8fe5-ebf51bae7dff.png',
  hookLeft: '/restoration5/hf_20260414_211704_fc37cef0-b61a-463d-95c7-07387941a8d2.png',
  hookRight: '/restoration5/hf_20260414_221611_185b9639-c6a6-4755-8f23-6c64e49f54c2.png',
  scripture1: '/restoration5/hf_20260414_221922_5aa18e0b-2c70-42ab-9c2e-f9b835aea1ae.png',
  scripture2: '/restoration5/hf_20260414_221941_0acfb11f-754d-4b65-b6b7-7d7a65eae2a6.png',
  scripture3: '/restoration5/hf_20260422_004340_90e40904-8a89-4b94-8269-a532f5f9ee59.png',
  principle1: '/restoration5/hf_20260422_004943_aaf3ce07-611f-4167-97ba-c53b7a2fdeeb.png',
  principle2: '/restoration5/hf_20260422_005319_1e5c95fa-f83d-4514-83a3-be8120e33a06.png',
  principle3: '/restoration5/hf_20260422_040515_0d5e58e0-0729-4ad5-a060-e7c229a7c94a.png',
  application1: '/restoration5/hf_20260422_040639_2bb12f30-fcba-4622-90f2-5a4dd64fc088.png',
  application2: '/restoration5/hf_20260422_042245_369a0645-1591-4ce4-b27b-d6de33220a2d.png',
  application3: '/restoration5/hf_20260422_043245_9b7eb58b-22bb-48a8-8764-c5da757d39d5.png',
  prayer: '/restoration5/hf_20260422_044321_b65108ba-fea3-486a-91bd-e055572c9bg3.png',
  closing: '/restoration5/hf_20260423_020226_e6ab7d22-ae36-40b7-983c-c939e64553bf.png',
};

/* ── Restoration 1 image map ── */
const R1 = {
  courtyardDoor: '/restoration1/hf_20260414_052152_0d84e8c5-405e-47c9-b2ac-b305071e3e75.png',
  bathPlants: '/restoration1/hf_20260414_052541_e8b75163-1b4a-41bb-9f5f-e62a0375dae5.png',
  vineDoor: '/restoration1/hf_20260414_052603_e157e053-f024-4596-a970-bc9c9830c26e.png',
  outdoorShower: '/restoration1/hf_20260414_052818_7e66aa90-20e0-4b89-8dae-59f80afa185d.png',
  stoneBedDark: '/restoration1/hf_20260414_053954_8eab2b6e-f7e1-4e13-90c8-a009ce499a47.png',
  stoneBedLight: '/restoration1/hf_20260414_054107_eb2996b7-a1e6-49f1-83b0-3a90f75c8209.png',
  warmSauna: '/restoration1/hf_20260414_054747_00ef631e-9f18-422a-9b64-f86347597ecc.png',
  darkSauna: '/restoration1/hf_20260414_055233_18d4b5eb-9558-471f-be7a-7c60d629c9cd.png',
  stillPool: '/restoration1/hf_20260414_060143_ac59f873-8396-49cc-b71a-31fc3624e0a1.png',
  spaTable: '/restoration1/hf_20260414_060351_457e393c-6660-4656-ac10-a8687f955863.png',
  archCouch: '/restoration1/hf_20260414_060514_629506c3-0888-4ddc-a3fc-b64fee0bc241.png',
  ivyNook: '/restoration1/hf_20260414_060559_8f073d25-fae7-412b-9d3d-b27100c2c7d0.png',
};

interface MoodBoardProps {
  project: Project;
  onInMoodBoard?: (inMoodBoard: boolean) => void;
}

export function MoodBoard({ project, onInMoodBoard }: MoodBoardProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const onInMoodBoardRef = useRef(onInMoodBoard);
  onInMoodBoardRef.current = onInMoodBoard;
  const isPeace = project.id === 'restoration1';
  const isHope = project.id === 'restoration3';
  const isStrength = project.id === 'strength';
  const isWholeness = project.id === 'wholeness';
  const isPurpose = project.id === 'purpose';
  const isConnection = project.id === 'connection';
  const isIdentity = project.id === 'identity';
  const isJoy = project.id === 'joy';
  const isForgiveness = project.id === 'forgiveness';
  const isSurrender = project.id === 'surrender';
  const isTrust = project.id === 'trust';

  useLayoutEffect(() => {
    if (isMobile || !sectionRef.current || !trackRef.current) return;

    const track = trackRef.current;

    const ctx = gsap.context(() => {
      // Main horizontal scroll tween — store reference for containerAnimation
      const mainTween = gsap.to(track, {
        x: () => -(track.scrollWidth - window.innerWidth),
        ease: 'none',
        scrollTrigger: {
          id: 'moodboard-pin',
          trigger: sectionRef.current,
          start: 'top top',
          end: () => `+=${track.scrollWidth - window.innerWidth}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (progressBarRef.current) {
              progressBarRef.current.style.width = `${self.progress * 100}%`;
            }
            if (progressTrackRef.current) {
              progressTrackRef.current.style.opacity =
                self.progress > 0 && self.progress < 1 ? '1' : '0';
            }
            onInMoodBoardRef.current?.(self.progress > 0 && self.progress < 1);
          },
          onLeave: () => onInMoodBoardRef.current?.(false),
          onLeaveBack: () => onInMoodBoardRef.current?.(false),
        },
      });

      // Parallax: offset each element by its data-speed factor
      gsap.utils.toArray<HTMLElement>('.mb-elem').forEach((el) => {
        const speed = parseFloat(el.dataset.speed || '0.5');
        gsap.to(el, {
          x: () => -(speed - 0.5) * (track.scrollWidth - window.innerWidth) * 0.3,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: () => `+=${track.scrollWidth - window.innerWidth}`,
            scrub: 1,
          },
        });
      });

      // Reveal animations
      gsap.utils.toArray<HTMLElement>('.mb-elem').forEach((el) => {
        const isText = el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'P' ||
                       el.classList.contains('text-xs') || el.classList.contains('text-sm') ||
                       el.classList.contains('text-white') || el.classList.contains('mb-text');
        const hasImage = el.querySelector('img');

        if (isText && !hasImage) {
          el.style.overflow = 'hidden';
          const inner = document.createElement('div');
          inner.style.willChange = 'transform';
          while (el.firstChild) inner.appendChild(el.firstChild);
          el.appendChild(inner);

          const isHeadline = el.tagName === 'H2' || el.tagName === 'H3';
          const dur = isHeadline ? 1.4 : 1.1;

          gsap.fromTo(
            inner,
            { yPercent: 110 },
            {
              yPercent: 0,
              duration: dur,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: el,
                containerAnimation: mainTween,
                start: 'left 90%',
                end: 'left 50%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        } else {
          const isCaption = el.classList.contains('text-xs') || el.classList.contains('text-sm');
          const xOffset = isCaption ? 40 : 60;
          const dur = isCaption ? 0.9 : 1.1;

          gsap.fromTo(
            el,
            { opacity: 0, x: xOffset },
            {
              opacity: parseFloat(el.style.opacity) || 1,
              x: 0,
              duration: dur,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: el,
                containerAnimation: mainTween,
                start: 'left 90%',
                end: 'left 50%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }
      });

      // Stagger reveal for list items
      gsap.utils.toArray<HTMLElement>('.mb-list-item').forEach((item, i) => {
        gsap.fromTo(
          item,
          { opacity: 0, x: 40 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            delay: i * 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: item.closest('.mb-elem') || item,
              containerAnimation: mainTween,
              start: 'left 85%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });

      // Scale effect on large images
      gsap.utils.toArray<HTMLElement>('.mb-elem img').forEach((img) => {
        const parent = img.closest<HTMLElement>('.mb-elem');
        if (!parent) return;
        const isLarge = parent.classList.contains('w-[45vw]') ||
                        parent.classList.contains('w-[35vw]') ||
                        parent.classList.contains('w-[50vw]') ||
                        parent.classList.contains('w-[40vw]');
        if (!isLarge) return;

        gsap.fromTo(
          img,
          { scale: 1.05 },
          {
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: parent,
              containerAnimation: mainTween,
              start: 'left 80%',
              end: 'left 20%',
              scrub: true,
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [isMobile]);

  const bgColor = project.overlayColor;

  if (isMobile) {
    if (isPeace) return <PeaceMobile />;
    if (isHope) return <HopeMobile project={project} />;
    if (isStrength) return <StrengthMobile project={project} />;
    if (isWholeness) return <WholenessMobile project={project} />;
    if (isPurpose) return <PurposeMobile project={project} />;
    if (isConnection) return <ConnectionMobile project={project} />;
    if (isIdentity) return <IdentityMobile project={project} />;
    if (isJoy) return <JoyMobile project={project} />;
    if (isForgiveness) return <ForgivenessMobile project={project} />;
    if (isSurrender) return <SurrenderMobile project={project} />;
    if (isTrust) return <TrustMobile project={project} />;
    return <MoodBoardMobile project={project} />;
  }

  return (
    <div ref={sectionRef} className="relative overflow-hidden" style={{ backgroundColor: bgColor }}>
      <div
        ref={trackRef}
        className="flex h-screen will-change-transform"
      >
        {isPeace ? (
          <PeaceZones project={project} />
        ) : isHope ? (
          <HopeZones project={project} />
        ) : isStrength ? (
          <StrengthZones project={project} />
        ) : isWholeness ? (
          <WholenessZones project={project} />
        ) : isPurpose ? (
          <PurposeZones project={project} />
        ) : isConnection ? (
          <ConnectionZones project={project} />
        ) : isIdentity ? (
          <IdentityZones project={project} />
        ) : isJoy ? (
          <JoyZones project={project} />
        ) : isForgiveness ? (
          <ForgivenessZones project={project} />
        ) : isSurrender ? (
          <SurrenderZones project={project} />
        ) : isTrust ? (
          <TrustZones project={project} />
        ) : (
          <DefaultZones project={project} />
        )}
      </div>

      {/* Progress bar */}
      <div
        ref={progressTrackRef}
        className="fixed bottom-0 left-0 right-0 h-[2px] z-50 transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(255,255,255,0.15)',
          opacity: 0,
        }}
      >
        <div
          ref={progressBarRef}
          className="h-full bg-white/60"
          style={{ width: '0%' }}
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DEFAULT ZONES — existing generic moodboard
   ════════════════════════════════════════════════════════════════ */

function DefaultZones({ project }: { project: Project }) {
  // Next Devotion chains across all projects in declared order:
  // residential → hospitality → wraps back to residential.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <>
      {/* Zone 1: Hero */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw' }}>
        <div
          className="mb-elem absolute top-[15%] left-[8%] w-[45vw] h-[70vh] overflow-hidden"
          data-speed="0.3"
        >
          <PhotoDevelopImage
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full"
            threshold={0.05}
          />
        </div>

        <h2
          className="mb-elem absolute bottom-[20%] right-[15%] text-[12vw] font-bold leading-[0.85] tracking-tighter text-white/90"
          data-speed="0.5"
        >
          {project.name.toUpperCase()}
        </h2>

        <div
          className="mb-elem absolute top-[25%] right-[25%] text-sm tracking-wide max-w-[200px] leading-relaxed text-white/60"
          data-speed="0.7"
        >
          <p>{project.description || 'A space where architecture meets editorial design.'}</p>
        </div>
      </div>

      {/* Zone 2: Data */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '180vw', backgroundColor: `color-mix(in srgb, ${project.overlayColor} 85%, var(--app-bg))` }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] bg-white p-4 shadow-lg"
          data-speed="0.8"
        >
          <PhotoDevelopImage
            src={project.images[1] || project.thumbnail}
            alt={`${project.name} detail`}
            className="w-[280px] h-[360px]"
            threshold={0.05}
          />
          <p className="text-xs mt-3 tracking-wide text-black/60">
            {project.location || 'Location'} — {project.year || '2025'}
          </p>
        </div>

        {project.area && (
          <div
            className="mb-elem absolute top-[50%] left-[35%] text-[18vw] font-bold text-white/10 leading-none"
            data-speed="0.2"
          >
            {project.area}m²
          </div>
        )}

        <div
          className="mb-elem absolute bottom-[15%] right-[20%] w-[35vw] h-[50vh] overflow-hidden"
          data-speed="0.4"
        >
          <PhotoDevelopImage
            src={project.images[2] || project.thumbnail}
            alt={`${project.name} view`}
            className="w-full h-full"
            threshold={0.05}
          />
        </div>

        {project.services && project.services.length > 0 && (
          <div
            className="mb-elem absolute top-[35%] right-[8%] max-w-[180px]"
            data-speed="0.9"
          >
            <div className="space-y-3 text-xs tracking-wide">
              {project.services.map((service, i) => (
                <div key={service.id} className="mb-list-item flex items-start gap-3">
                  <span className="text-white/40">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-white/70">{service.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zone 3: Craft */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '220vw', backgroundColor: `color-mix(in srgb, ${project.overlayColor} 70%, black 10%)` }}>
        <h3
          className="mb-elem absolute top-[20%] left-[10%] text-[10vw] font-bold text-white leading-none tracking-tight"
          data-speed="0.6"
        >
          CRAFT
        </h3>

        <div
          className="mb-elem absolute top-[55%] left-[25%] w-[50vw] h-[35vh] overflow-hidden"
          data-speed="0.3"
        >
          <PhotoDevelopImage
            src={project.images[3] || project.images[1] || project.thumbnail}
            alt={`${project.name} craft`}
            className="w-full h-full"
            threshold={0.05}
          />
        </div>

        <div
          className="mb-elem absolute bottom-[25%] right-[15%] text-white/80 text-sm max-w-[250px] leading-relaxed tracking-wide"
          data-speed="0.8"
        >
          <p>
            {project.description || 'Every detail matters. From material selection to spatial flow, we consider how spaces evolve with their inhabitants.'}
          </p>
        </div>

        <div
          className="mb-elem absolute top-[15%] right-[25%] bg-white/95 p-3 shadow-xl"
          data-speed="0.7"
        >
          <PhotoDevelopImage
            src={project.images[4] || project.images[0]}
            alt="Detail study"
            className="w-[200px] h-[250px]"
            threshold={0.05}
          />
          <p className="text-[10px] mt-2 tracking-wider text-black/50 uppercase">Detail Study</p>
        </div>
      </div>

      {/* Zone 4: Year */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${project.overlayColor} 90%, black 5%)` }}>
        <div
          className="mb-elem absolute top-[30%] left-[15%] text-[14vw] font-bold text-white/15 leading-none"
          data-speed="0.25"
        >
          {project.year || '2025'}
        </div>

        <div
          className="mb-elem absolute top-[20%] right-[20%] w-[40vw] h-[60vh] overflow-hidden shadow-2xl"
          data-speed="0.5"
        >
          <PhotoDevelopImage
            src={project.images[5] || project.thumbnail}
            alt={`${project.name} featured`}
            className="w-full h-full"
            threshold={0.05}
          />
        </div>

        <p
          className="mb-elem absolute bottom-[20%] left-[20%] text-white text-xs tracking-widest uppercase"
          data-speed="0.75"
        >
          {categoryLabel[project.category]}
        </p>
      </div>

      {/* Zone 5: CTA */}
      <div className="relative flex-shrink-0 h-screen flex items-center justify-center" style={{ width: '100vw', backgroundColor: 'rgba(0,0,0,0.15)' }}>
        <div className="text-center">
          <h3 className="text-[8vw] font-bold text-white mb-8 tracking-tight">
            Let's Talk
          </h3>
          <p className="text-white/70 text-sm tracking-wide mb-12 max-w-md mx-auto">
            Ready to create something extraordinary? Reach out and let's start a conversation about your next project.
          </p>
          <button className="px-8 py-4 bg-white text-mersi-dark text-sm tracking-wide hover:bg-white/90 transition-colors">
            Get in Touch
          </button>
        </div>
      </div>

      {/* Zone 6: Next Devotion Hero */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   PEACE ZONES — Restoration of Peace devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function PeaceZones({ project }: { project: Project }) {
  const ov = '#8B8378';

  // Find the next project in the same category, wrapping around
  // Next Devotion chains across all projects in declared order:
  // residential → hospitality → wraps back to residential.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];
  return (
    <>
      {/* ── Zone 1: Peace Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image1.png" alt="Courtyard doorway" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(5rem, 14vw, 16rem)' }}
          data-speed="0.5"
        >
          Peace
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s take a moment and let God restore the peace in and around you.
        </div>
      </div>

      {/* ── Zone 2: The Reflection ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--app-bg))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.8rem, 4.5vw, 4.5rem)' }}
          data-speed="0.5"
        >
          When was the last time you truly felt at rest?
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          Not just asleep, but at rest&mdash;deep in your bones, quiet in your thoughts, unhurried in your spirit? For most of us, that kind of stillness feels like a distant memory. We carry tension in our shoulders before our feet even hit the floor in the morning.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image2.png" alt="Serene bath with lush plants" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          We live in a world that rewards constant motion. Productivity is praised. Busyness is a badge. And somewhere along the way, rest became something we felt guilty about instead of something we were created for.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image3.png" alt="Restoration detail" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          David, the writer of Psalm 23, was no stranger to chaos. He had been hunted by a king, betrayed by friends, and burdened by war. Yet in the middle of all that turmoil, he wrote what may be the most peaceful passage in all of Scripture. He didn&rsquo;t write about rest from a place of leisure&mdash;he wrote about it from a place of lived experience with God&rsquo;s faithfulness.
        </div>

        {/* Gallery row — full-height images with percentage gaps to prevent overlap */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image4.png" alt="Outdoor shower with plants" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image5.png" alt="Shelf with mirror and bottles" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image6.png" alt="Arch doorway with stone basin" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          Notice the language: &ldquo;He makes me lie down.&rdquo; God doesn&rsquo;t suggest rest. He doesn&rsquo;t pencil it into our calendar if we have time. He makes us lie down. Like a shepherd who knows that an exhausted sheep will wander into danger, God sometimes brings us to a full stop because He knows what we need more than we do.
        </div>
      </div>

      {/* ── Zone 4: Still Waters + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--app-bg))` }}>
        {/* Image 1 — full-height, matching Zone 3 size */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image7.png" alt="Still waters" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        {/* Text column between images */}
        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          And then He leads us beside &ldquo;quiet waters.&rdquo; Not raging rivers. Not crashing waves. Quiet waters. The Hebrew word for &ldquo;refreshes&rdquo; here is the word <em>shub</em>&mdash;which literally means &ldquo;to return&rdquo; or &ldquo;to restore.&rdquo; God&rsquo;s rest isn&rsquo;t just about stopping. It&rsquo;s about returning. Returning to the person you were before the anxiety took hold. Before the grief rewired your thinking. Before the burnout hollowed you out. God&rsquo;s restoration brings you back to wholeness.
        </div>

        {/* Image 2 — full-height, matching Zone 3 size */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image8.png" alt="Restoration detail" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          God&rsquo;s restoration begins not with doing more, but with allowing ourselves to be led into stillness.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          Peace is not the absence of problems; it is the presence of a Shepherd who knows exactly where to take us when we are depleted. Restoration of the soul starts when we stop striving and start trusting the One who never grows weary of caring for us.
        </div>

        {/* Image 3 — end of zone, full-height matching Zone 3 size */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image9.png" alt="Restoration space" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        {/* Text 1 */}
        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Maybe you&rsquo;re reading this in the middle of a packed schedule, on your phone between meetings, or late at night when the house is finally quiet. Wherever you are, consider this an invitation from your Shepherd. He is not asking you to earn rest&mdash;He is leading you to it.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[28%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;Lord, lead me beside still waters. Refresh my soul.&rdquo;
        </div>

        {/* Image 1 */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image10.png" alt="Application space" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        {/* Image 2 */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image11.png" alt="Peaceful retreat" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        {/* Text 2 */}
        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          Today, set aside just ten minutes. No phone. No agenda. No noise. Sit somewhere quiet and say it out loud. And then let Him. Don&rsquo;t rush it. Don&rsquo;t fill the silence with a to-do list. Just be led.
        </div>

        {/* Image 3 — after text 2 */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image12.png" alt="Restoration moment" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Restoration
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          Lord, I confess that I have been running on empty. I have searched for rest in places that cannot give it. Today, I come to You, the Shepherd of my soul. Lead me to the green pastures and the quiet waters that only You can provide. Refresh what is weary in me. Restore what has been lost. Bring me back to wholeness, peace, and strength. I trust Your leading. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[8%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Psalm 23 &mdash; Restoration of Peace
        </p>

        {/* Final image — 4:3 ratio, wider to show full image */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration1/image13.png" alt="Window nook with orchids" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Peace" overlayColor={ov} />

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          {/* Left Content */}
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>

          {/* Right Image */}
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   PEACE MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function PeaceMobile() {
  const bg = '#8B8378';
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--app-bg))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Peace Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s take a moment and let God restore the peace in and around you.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(4rem, 18vw, 10rem)' }}
        >
          Peace
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src={R1.courtyardDoor} alt="Courtyard doorway" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          When was the last time you truly felt at rest?
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          Not just asleep, but at rest&mdash;deep in your bones, quiet in your thoughts, unhurried in your spirit? For most of us, that kind of stillness feels like a distant memory. We carry tension in our shoulders before our feet even hit the floor in the morning.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          We live in a world that rewards constant motion. Productivity is praised. Busyness is a badge. And somewhere along the way, rest became something we felt guilty about instead of something we were created for.
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          David, the writer of Psalm 23, was no stranger to chaos. He had been hunted by a king, betrayed by friends, and burdened by war. Yet in the middle of all that turmoil, he wrote what may be the most peaceful passage in all of Scripture.
        </p>
        <PhotoDevelopImage src={R1.outdoorShower} alt="Outdoor shower" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Notice the language: &ldquo;He makes me lie down.&rdquo; God doesn&rsquo;t suggest rest. He makes us lie down. Like a shepherd who knows that an exhausted sheep will wander into danger, God sometimes brings us to a full stop because He knows what we need more than we do.
        </p>
        <PhotoDevelopImage src={R1.stoneBedDark} alt="Stone bed" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          And then He leads us beside &ldquo;quiet waters.&rdquo; Not raging rivers. Not crashing waves. Quiet waters. The Hebrew word for &ldquo;refreshes&rdquo; here is the word <em>shub</em>&mdash;which literally means &ldquo;to return&rdquo; or &ldquo;to restore.&rdquo; God&rsquo;s restoration brings you back to wholeness.
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={R1.bathPlants} alt="Bath with plants" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src={R1.warmSauna} alt="Warm sauna" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          God&rsquo;s restoration begins not with doing more, but with allowing ourselves to be led into stillness.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Peace is not the absence of problems; it is the presence of a Shepherd who knows exactly where to take us when we are depleted.
        </p>
        <PhotoDevelopImage src={R1.stillPool} alt="Tranquil pool" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Maybe you&rsquo;re reading this in the middle of a packed schedule, on your phone between meetings, or late at night when the house is finally quiet. Wherever you are, consider this an invitation from your Shepherd. He is not asking you to earn rest&mdash;He is leading you to it.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;Lord, lead me beside still waters. Refresh my soul.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Today, set aside just ten minutes. No phone. No agenda. No noise. And then let Him. Don&rsquo;t rush it. Just be led.
        </p>
        <PhotoDevelopImage src={R1.archCouch} alt="Resting couch" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Restoration</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          Lord, I confess that I have been running on empty. I have searched for rest in places that cannot give it. Today, I come to You, the Shepherd of my soul. Lead me to the green pastures and the quiet waters that only You can provide. Refresh what is weary in me. Restore what has been lost. Bring me back to wholeness, peace, and strength. I trust Your leading. Amen.
        </p>
        <PhotoDevelopImage src={R1.ivyNook} alt="Peaceful nook" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={R1.stoneBedLight} alt="Serene stone bed" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   HOPE ZONES — Restoration of Hope devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function HopeZones({ project }: { project: Project }) {
  const ov = project.overlayColor;

  // Next Devotion chains across all projects in declared order:
  // residential → hospitality → wraps back to residential.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <>
      {/* ── Zone 1: Hope Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image1.png" alt="Hope doorway" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(5rem, 14vw, 16rem)' }}
          data-speed="0.5"
        >
          Hope
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s explore a future you cannot see yet, and the God who holds it.
        </div>
      </div>

      {/* ── Zone 2: The Hook ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--app-bg))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.8rem, 4.5vw, 4.5rem)' }}
          data-speed="0.5"
        >
          Hope is a fragile thing.
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          It can survive extraordinary hardship, but it can also be slowly suffocated by the weight of unanswered prayers, closed doors, and the quiet fear that maybe things will never get better. Perhaps you&rsquo;re in a season where hope feels more like a word on a greeting card than something real&mdash;a concept that sounds beautiful in theory but feels impossible in your actual life.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image2.png" alt="Hope landscape" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          You&rsquo;ve prayed. You&rsquo;ve waited. You&rsquo;ve tried to be faithful. And yet the breakthrough hasn&rsquo;t come. The healing hasn&rsquo;t happened. The relationship hasn&rsquo;t been reconciled. And in the silence, a dangerous whisper creeps in: &ldquo;What if this is all there is?&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image3.png" alt="Hope detail" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          Jeremiah 29:11 is one of the most beloved verses in Scripture, but its full power is lost if we don&rsquo;t understand when God spoke it. This was not a promise delivered in a season of triumph. It was a letter&mdash;written by the prophet Jeremiah&mdash;to a people in exile. The Israelites had been ripped from their homeland and carried off to Babylon.
        </div>

        {/* Gallery row */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image4.png" alt="Scripture scene" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image5.png" alt="Exile landscape" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image6.png" alt="Promise fulfilled" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          False prophets were telling them the exile would be brief, that God would rescue them any day now. But God&rsquo;s actual message through Jeremiah was far more challenging: settle in. Build houses. Plant gardens. The exile would last seventy years. And it is into that crushing news that God speaks this promise of hope.
        </div>
      </div>

      {/* ── Zone 4: God's Promise + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--app-bg))` }}>
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image7.png" alt="God's plans" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          He doesn&rsquo;t deny the difficulty. He doesn&rsquo;t promise a quick fix. He says, in essence: &ldquo;I know this is not what you wanted to hear. But I have not abandoned you. I have plans for you&mdash;and those plans end in flourishing, not destruction.&rdquo; The hope God offers is not tied to a timeline we control. It is anchored in a future He has already secured. And then comes the invitation: &ldquo;You will seek me and find me when you seek me with all your heart. I will be found by you,&rdquo; declares the Lord. Restoration doesn&rsquo;t begin with a change in circumstances. It begins with a turning of the heart.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image8.png" alt="Hope restored" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          God&rsquo;s plans for us do not expire in seasons of waiting.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          Hope is not wishful thinking&mdash;it is the confident assurance that God&rsquo;s intentions toward us are good, even when our circumstances suggest otherwise. Restoration of hope does not require an escape from the hard season. It requires a redirecting of our gaze toward the One who holds the future we cannot yet see.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image11.png" alt="Future hope" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          If you are in a season of waiting and your hope is wearing thin, do something countercultural today: plant something. Not because the exile is over, but because you believe God when He says it won&rsquo;t last forever. This could be literal&mdash;plant a seed, tend a garden. Or it could be metaphorical&mdash;invest in a friendship, start that project you&rsquo;ve been putting off, sign up for the class.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;Planting in exile is an act of defiant hope.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image10.png" alt="Planting in exile" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image13.png" alt="Defiant hope" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          It declares that you trust God&rsquo;s future more than your present feelings. And as you plant, seek Him. Not casually. With all your heart. Because He has promised: when you search for Him wholeheartedly, you will find Him. And finding Him is the beginning of every restoration.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image12.png" alt="Restoration moment" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Restoration
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          Father, I confess that my hope has grown thin. I&rsquo;ve been waiting, and the waiting has worn me down. But today I choose to believe Your word over my weariness. You said You have plans for me&mdash;plans for a hope and a future. I can&rsquo;t see that future yet, but I trust the One who holds it. Restore my hope, Lord. Give me the courage to plant in exile, to build in the waiting, and to seek You with everything I have. I believe that You will be found. Bring me back, Lord. Bring me home. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Jeremiah 29:11 &mdash; Restoration of Hope
        </p>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src="/restoration3/image14.png" alt="Hope fulfilled" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Hope" overlayColor={ov} />

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   HOPE MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function HopeMobile({ project }: { project: Project }) {
  const bg = project.overlayColor;
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--app-bg))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Hope Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s explore a future you cannot see yet, and the God who holds it.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(4rem, 18vw, 10rem)' }}
        >
          Hope
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src="/restoration3/image1.png" alt="Hope doorway" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          Hope is a fragile thing.
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          It can survive extraordinary hardship, but it can also be slowly suffocated by the weight of unanswered prayers, closed doors, and the quiet fear that maybe things will never get better. Perhaps you&rsquo;re in a season where hope feels more like a word on a greeting card than something real&mdash;a concept that sounds beautiful in theory but feels impossible in your actual life.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          You&rsquo;ve prayed. You&rsquo;ve waited. You&rsquo;ve tried to be faithful. And yet the breakthrough hasn&rsquo;t come. The healing hasn&rsquo;t happened. The relationship hasn&rsquo;t been reconciled. And in the silence, a dangerous whisper creeps in: &ldquo;What if this is all there is?&rdquo;
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Jeremiah 29:11 is one of the most beloved verses in Scripture, but its full power is lost if we don&rsquo;t understand when God spoke it. This was not a promise delivered in a season of triumph. It was a letter&mdash;written by the prophet Jeremiah&mdash;to a people in exile.
        </p>
        <PhotoDevelopImage src="/restoration3/image4.png" alt="Scripture scene" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          False prophets were telling them the exile would be brief. But God&rsquo;s actual message was far more challenging: settle in. Build houses. Plant gardens. The exile would last seventy years. And it is into that crushing news that God speaks this promise of hope. He doesn&rsquo;t deny the difficulty. He doesn&rsquo;t promise a quick fix. He says: &ldquo;I have not abandoned you. I have plans for you&mdash;and those plans end in flourishing, not destruction.&rdquo;
        </p>
        <PhotoDevelopImage src="/restoration3/image5.png" alt="Exile landscape" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          And then comes the invitation: &ldquo;You will seek me and find me when you seek me with all your heart. I will be found by you,&rdquo; declares the Lord. Restoration doesn&rsquo;t begin with a change in circumstances. It begins with a turning of the heart&mdash;toward the God who has been there all along, even in exile.
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src="/restoration3/image2.png" alt="Hope landscape" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src="/restoration3/image7.png" alt="God's plans" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          God&rsquo;s plans for us do not expire in seasons of waiting.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Hope is not wishful thinking&mdash;it is the confident assurance that God&rsquo;s intentions toward us are good, even when our circumstances suggest otherwise. Restoration of hope does not require an escape from the hard season. It requires a redirecting of our gaze toward the One who holds the future we cannot yet see.
        </p>
        <PhotoDevelopImage src="/restoration3/image8.png" alt="Hope restored" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          If you are in a season of waiting and your hope is wearing thin, do something countercultural today: plant something. Not because the exile is over, but because you believe God when He says it won&rsquo;t last forever. This could be literal&mdash;plant a seed, tend a garden. Or it could be metaphorical&mdash;invest in a friendship, start that project you&rsquo;ve been putting off, sign up for the class.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;Planting in exile is an act of defiant hope.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          It declares that you trust God&rsquo;s future more than your present feelings. And as you plant, seek Him. Not casually. With all your heart. Because He has promised: when you search for Him wholeheartedly, you will find Him. And finding Him is the beginning of every restoration.
        </p>
        <PhotoDevelopImage src="/restoration3/image10.png" alt="Planting in exile" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Restoration</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          Father, I confess that my hope has grown thin. I&rsquo;ve been waiting, and the waiting has worn me down. But today I choose to believe Your word over my weariness. You said You have plans for me&mdash;plans for a hope and a future. I can&rsquo;t see that future yet, but I trust the One who holds it. Restore my hope, Lord. Give me the courage to plant in exile, to build in the waiting, and to seek You with everything I have. I believe that You will be found. Bring me back, Lord. Bring me home. Amen.
        </p>
        <PhotoDevelopImage src="/restoration3/image13.png" alt="Hope fulfilled" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src="/restoration3/image14.png" alt="Restoration complete" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STRENGTH ZONES — Restoration of Strength devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function StrengthZones({ project }: { project: Project }) {
  const ov = project.overlayColor;

  // Next Devotion chains across all projects in declared order:
  // residential → hospitality → wraps back to residential.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <>
      {/* ── Zone 1: Strength Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.hero} alt="Strength horizon" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(5rem, 14vw, 16rem)', paddingBottom: '0.22em' }}
          data-speed="0.5"
        >
          Strength
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s explore the strength that meets you when you&rsquo;ve reached the end of your own.
        </div>
      </div>

      {/* ── Zone 2: The Hook ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--app-bg))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.8rem, 4.5vw, 4.5rem)' }}
          data-speed="0.5"
        >
          There&rsquo;s a kind of tired that sleep can&rsquo;t fix.
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          You know the one. It&rsquo;s the weariness that settles in after months of caregiving with no end in sight. It&rsquo;s the heaviness you feel when you&rsquo;ve been praying the same prayer for years and the answer hasn&rsquo;t come. It&rsquo;s the exhaustion of holding it together for everyone around you while quietly wondering who is holding you together.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.hookLeft} alt="Weariness landscape" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          This is not laziness. This is depletion. And if you&rsquo;re there today, you need to hear something: you are not weak for being tired. Even the strongest among us reach the end of themselves.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.hookRight} alt="Depleted detail" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          Isaiah wrote these words to the people of Israel during one of the darkest chapters in their history. They were in exile, far from home, watching everything they had built crumble around them. They were asking the question so many of us ask in seasons of depletion: &ldquo;Has God forgotten me?&rdquo;
        </div>

        {/* Gallery row */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.scripture1} alt="Scripture scene" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.scripture2} alt="Exile horizon" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.scripture3} alt="Inexhaustible nature" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          And God&rsquo;s response through Isaiah is remarkable. He doesn&rsquo;t scold them for being tired. He doesn&rsquo;t tell them to try harder. Instead, He points them to His own inexhaustible nature: &ldquo;The Lord is the everlasting God, the Creator of the ends of the earth. He will not grow tired or weary.&rdquo; The God who sustains the galaxies does not run out of strength&mdash;and He offers that same limitless power to the depleted.
        </div>
      </div>

      {/* ── Zone 4: The Condition + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--app-bg))` }}>
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.principle1} alt="Wait with eager expectation" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          But notice the condition: &ldquo;those who hope in the Lord.&rdquo; The Hebrew word for &ldquo;hope&rdquo; here is <em className="not-italic font-['Cormorant_Garamond'] italic">qavah</em>, which means &ldquo;to wait with eager expectation.&rdquo; It&rsquo;s not passive resignation. It&rsquo;s active trust. It&rsquo;s choosing to believe that God&rsquo;s strength will meet you exactly where your own runs out. And when it does, you don&rsquo;t just survive&mdash;you soar.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.principle2} alt="Strength renewed" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          When we reach the end of our own resources, we arrive at the beginning of His.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          God&rsquo;s restoration of strength does not depend on our ability to generate it ourselves. It depends on our willingness to wait on Him. The renewed strength God promises is not a return to self-sufficiency&mdash;it is a deeper dependence on the One whose power never diminishes.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.principle3} alt="Wings rising" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          If you&rsquo;re feeling depleted today, resist the urge to push harder. Instead, pause and acknowledge where you&rsquo;ve been trying to manufacture strength on your own. Then, bring that specific area of exhaustion to God in prayer. Tell Him exactly where you&rsquo;re running on empty&mdash;your marriage, your parenting, your health, your faith.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;Your emptiness is not the end of the story. It&rsquo;s the place where God&rsquo;s restoration begins.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.application1} alt="Resting in His power" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.application2} alt="Verse on the wall" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          Ask Him not for the energy to keep performing, but for the renewed strength that comes from resting in His power. Write down Isaiah 40:31 and place it somewhere you&rsquo;ll see it this week. Let it remind you: your emptiness is not the end of the story. It&rsquo;s the place where God&rsquo;s restoration begins.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.application3} alt="Restoration begins" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Restoration
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          Father, I am tired. Not the kind of tired that a good night&rsquo;s sleep can fix, but the kind that reaches down into my spirit. I confess that I&rsquo;ve been trying to run on my own fuel, and I have nothing left. Today, I choose to wait on You. I place my hope&mdash;my eager expectation&mdash;in Your unfailing strength. Renew me, Lord. Restore what depletion has taken. Lift me up so I can soar again. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Isaiah 40:31 &mdash; Restoration of Strength
        </p>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={S.prayer} alt="Soar like eagles" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Strength" overlayColor={ov} />

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   STRENGTH MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function StrengthMobile({ project }: { project: Project }) {
  const bg = project.overlayColor;
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--app-bg))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Strength Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s explore the strength that meets you when you&rsquo;ve reached the end of your own.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(4rem, 18vw, 10rem)' }}
        >
          Strength
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src={S.hero} alt="Strength horizon" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          There&rsquo;s a kind of tired that sleep can&rsquo;t fix.
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          You know the one. It&rsquo;s the weariness that settles in after months of caregiving with no end in sight. It&rsquo;s the heaviness you feel when you&rsquo;ve been praying the same prayer for years and the answer hasn&rsquo;t come. It&rsquo;s the exhaustion of holding it together for everyone around you while quietly wondering who is holding you together.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          This is not laziness. This is depletion. And if you&rsquo;re there today, you need to hear something: you are not weak for being tired. Even the strongest among us reach the end of themselves.
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Isaiah wrote these words to the people of Israel during one of the darkest chapters in their history. They were in exile, far from home, watching everything they had built crumble around them. They were asking the question so many of us ask in seasons of depletion: &ldquo;Has God forgotten me?&rdquo;
        </p>
        <PhotoDevelopImage src={S.scripture1} alt="Scripture scene" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          And God&rsquo;s response through Isaiah is remarkable. He doesn&rsquo;t scold them for being tired. He doesn&rsquo;t tell them to try harder. Instead, He points them to His own inexhaustible nature: &ldquo;The Lord is the everlasting God, the Creator of the ends of the earth. He will not grow tired or weary.&rdquo; The God who sustains the galaxies does not run out of strength&mdash;and He offers that same limitless power to the depleted.
        </p>
        <PhotoDevelopImage src={S.scripture2} alt="Exile horizon" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          But notice the condition: &ldquo;those who hope in the Lord.&rdquo; The Hebrew word for &ldquo;hope&rdquo; here is <em className="not-italic font-['Cormorant_Garamond'] italic">qavah</em>, which means &ldquo;to wait with eager expectation.&rdquo; It&rsquo;s not passive resignation. It&rsquo;s active trust. It&rsquo;s choosing to believe that God&rsquo;s strength will meet you exactly where your own runs out. And when it does, you don&rsquo;t just survive&mdash;you soar.
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={S.hookLeft} alt="Weariness landscape" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src={S.principle1} alt="Wait with eager expectation" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          When we reach the end of our own resources, we arrive at the beginning of His.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          God&rsquo;s restoration of strength does not depend on our ability to generate it ourselves. It depends on our willingness to wait on Him. The renewed strength God promises is not a return to self-sufficiency&mdash;it is a deeper dependence on the One whose power never diminishes.
        </p>
        <PhotoDevelopImage src={S.principle2} alt="Strength renewed" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          If you&rsquo;re feeling depleted today, resist the urge to push harder. Instead, pause and acknowledge where you&rsquo;ve been trying to manufacture strength on your own. Then, bring that specific area of exhaustion to God in prayer. Tell Him exactly where you&rsquo;re running on empty&mdash;your marriage, your parenting, your health, your faith.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;Your emptiness is not the end of the story. It&rsquo;s the place where God&rsquo;s restoration begins.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Ask Him not for the energy to keep performing, but for the renewed strength that comes from resting in His power. Write down Isaiah 40:31 and place it somewhere you&rsquo;ll see it this week. Let it remind you: your emptiness is not the end of the story. It&rsquo;s the place where God&rsquo;s restoration begins.
        </p>
        <PhotoDevelopImage src={S.application1} alt="Resting in His power" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Restoration</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          Father, I am tired. Not the kind of tired that a good night&rsquo;s sleep can fix, but the kind that reaches down into my spirit. I confess that I&rsquo;ve been trying to run on my own fuel, and I have nothing left. Today, I choose to wait on You. I place my hope&mdash;my eager expectation&mdash;in Your unfailing strength. Renew me, Lord. Restore what depletion has taken. Lift me up so I can soar again. Amen.
        </p>
        <PhotoDevelopImage src={S.prayer} alt="Soar like eagles" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={S.closing} alt="Restoration of strength" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   WHOLENESS ZONES — Restoration of Wholeness devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function WholenessZones({ project }: { project: Project }) {
  const ov = project.overlayColor;

  // Next Devotion chains across all projects in declared order:
  // residential → hospitality → wraps back to residential.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <>
      {/* ── Zone 1: Wholeness Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.hero} alt="Restored harvest" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(4rem, 12vw, 14rem)', paddingBottom: '0.22em' }}
          data-speed="0.5"
        >
          Wholeness
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s explore the years restored, and the God who repays what was lost.
        </div>
      </div>

      {/* ── Zone 2: The Hook ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--app-bg))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.8rem, 4.5vw, 4.5rem)' }}
          data-speed="0.5"
        >
          Some losses leave a mark you cannot see.
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          Some losses leave a mark you can see&mdash;a house destroyed, a relationship ended, a career derailed. But some of the deepest losses are invisible. They&rsquo;re the years you spent in a fog of grief that swallowed your joy. They&rsquo;re the seasons of your life that were consumed by an addiction, a toxic relationship, or a crisis that took everything you had just to survive.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.hookLeft} alt="Lost years" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          And when you finally come through on the other side, there&rsquo;s a quiet ache that whispers: &ldquo;You can&rsquo;t get those years back.&rdquo; The missed milestones. The joy you should have felt. The person you could have become if life hadn&rsquo;t taken such a devastating detour. It&rsquo;s one of the heaviest burdens a person can carry&mdash;the grief of lost time.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.hookRight} alt="Quiet ache" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The people of Israel knew this grief intimately. In the book of Joel, a devastating plague of locusts had swept through the land, consuming everything&mdash;crops, vineyards, orchards. What had taken years to cultivate was devoured in days. The destruction was total. The people were left staring at bare fields and empty storehouses, wondering if anything could ever grow again.
        </div>

        {/* Gallery row */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.scripture1} alt="Bare fields" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.scripture2} alt="Empty storehouse" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.scripture3} alt="Years repaid" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          And it is into this desolation that God speaks one of the most breathtaking promises in all of Scripture: &ldquo;I will repay you for the years the locusts have eaten.&rdquo; Not just the crops. The years. God doesn&rsquo;t just promise to replace what was lost&mdash;He promises to restore the time that was consumed by destruction.
        </div>
      </div>

      {/* ── Zone 4: Redemption + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--app-bg))` }}>
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.principle1} alt="Outside of time" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          This is a promise that defies human logic. We cannot rewind the clock. We cannot unlive our hardest seasons. But God operates outside the boundaries of time. His restoration doesn&rsquo;t mean He erases the past&mdash;it means He redeems it. He takes the very years that were devoured and fills the space with abundance, purpose, and praise. David echoed this same longing in Psalm 51 when he cried out, &ldquo;Restore to me the joy of your salvation.&rdquo; The joy hadn&rsquo;t been destroyed forever. It was waiting to be given back.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.principle2} alt="Joy returning" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          No season of loss is beyond the reach of God&rsquo;s restoration.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          He is not limited by the damage that has been done or the time that has passed. God&rsquo;s promise to repay the years is not about turning back the clock&mdash;it is about filling what remains with such abundance and purpose that the coming chapters of your story will overflow with the goodness that was missing from the ones before. Wholeness does not require a perfect past. It requires a faithful God.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.principle3} alt="Faithful God" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Take a moment to name the &ldquo;locusts&rdquo; in your story. What consumed the years? Was it illness? Regret? A season of wandering from God? Whatever it is, bring it to Him&mdash;not with shame, but with expectation. God doesn&rsquo;t ask you to pretend the loss didn&rsquo;t happen. He asks you to believe that He is able to fill the space those years left behind with something only He can give.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;God is restoring what was lost.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.application1} alt="Naming the locusts" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.application2} alt="Truth on a note" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          Write this truth somewhere personal&mdash;in your journal, on a note beside your bed: &ldquo;God is restoring what was lost.&rdquo; And then begin to look for evidence of it. Watch for the small mercies, the unexpected open doors, the moments of joy that catch you off guard. That is restoration at work.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.application3} alt="Restoration at work" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Restoration
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          God, You know the years that have been taken from me. You know the seasons I grieve, the joy I missed, and the person I wish I had been. I bring all of it to You today&mdash;not with bitterness, but with hope. You promised to repay what the locusts have eaten, and I am choosing to believe that promise. Restore my wholeness. Redeem my story. Fill what remains with Your abundance and purpose. Create in me a clean heart and renew a steadfast spirit within me. I trust that my best days are still ahead because You are in them. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Joel 2:25&ndash;26 &mdash; Restoration of Wholeness
        </p>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={W.prayer} alt="Years redeemed" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Wholeness" overlayColor={ov} />

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   WHOLENESS MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function WholenessMobile({ project }: { project: Project }) {
  const bg = project.overlayColor;
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--app-bg))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Wholeness Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s explore the years restored, and the God who repays what was lost.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(3rem, 14vw, 8rem)', paddingBottom: '0.18em' }}
        >
          Wholeness
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src={W.hero} alt="Restored harvest" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          Some losses leave a mark you cannot see.
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          Some losses leave a mark you can see&mdash;a house destroyed, a relationship ended, a career derailed. But some of the deepest losses are invisible. They&rsquo;re the years you spent in a fog of grief that swallowed your joy. They&rsquo;re the seasons of your life that were consumed by an addiction, a toxic relationship, or a crisis that took everything you had just to survive.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          And when you finally come through on the other side, there&rsquo;s a quiet ache that whispers: &ldquo;You can&rsquo;t get those years back.&rdquo; The missed milestones. The joy you should have felt. The person you could have become if life hadn&rsquo;t taken such a devastating detour. It&rsquo;s one of the heaviest burdens a person can carry&mdash;the grief of lost time.
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          The people of Israel knew this grief intimately. In the book of Joel, a devastating plague of locusts had swept through the land, consuming everything&mdash;crops, vineyards, orchards. What had taken years to cultivate was devoured in days. The destruction was total. The people were left staring at bare fields and empty storehouses, wondering if anything could ever grow again.
        </p>
        <PhotoDevelopImage src={W.scripture1} alt="Bare fields" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          And it is into this desolation that God speaks one of the most breathtaking promises in all of Scripture: &ldquo;I will repay you for the years the locusts have eaten.&rdquo; Not just the crops. The years. God doesn&rsquo;t just promise to replace what was lost&mdash;He promises to restore the time that was consumed by destruction.
        </p>
        <PhotoDevelopImage src={W.scripture2} alt="Empty storehouse" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          This is a promise that defies human logic. We cannot rewind the clock. We cannot unlive our hardest seasons. But God operates outside the boundaries of time. His restoration doesn&rsquo;t mean He erases the past&mdash;it means He redeems it. He takes the very years that were devoured and fills the space with abundance, purpose, and praise. David echoed this same longing in Psalm 51 when he cried out, &ldquo;Restore to me the joy of your salvation.&rdquo;
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={W.hookLeft} alt="Lost years" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src={W.principle1} alt="Outside of time" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          No season of loss is beyond the reach of God&rsquo;s restoration.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          He is not limited by the damage that has been done or the time that has passed. God&rsquo;s promise to repay the years is not about turning back the clock&mdash;it is about filling what remains with such abundance and purpose that the coming chapters of your story will overflow with the goodness that was missing from the ones before. Wholeness does not require a perfect past. It requires a faithful God.
        </p>
        <PhotoDevelopImage src={W.principle2} alt="Joy returning" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Take a moment to name the &ldquo;locusts&rdquo; in your story. What consumed the years? Was it illness? Regret? A season of wandering from God? Whatever it is, bring it to Him&mdash;not with shame, but with expectation. God doesn&rsquo;t ask you to pretend the loss didn&rsquo;t happen. He asks you to believe that He is able to fill the space those years left behind with something only He can give.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;God is restoring what was lost.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Write this truth somewhere personal&mdash;in your journal, on a note beside your bed: &ldquo;God is restoring what was lost.&rdquo; And then begin to look for evidence of it. Watch for the small mercies, the unexpected open doors, the moments of joy that catch you off guard. That is restoration at work.
        </p>
        <PhotoDevelopImage src={W.application1} alt="Naming the locusts" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Restoration</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          God, You know the years that have been taken from me. You know the seasons I grieve, the joy I missed, and the person I wish I had been. I bring all of it to You today&mdash;not with bitterness, but with hope. You promised to repay what the locusts have eaten, and I am choosing to believe that promise. Restore my wholeness. Redeem my story. Fill what remains with Your abundance and purpose. Create in me a clean heart and renew a steadfast spirit within me. I trust that my best days are still ahead because You are in them. Amen.
        </p>
        <PhotoDevelopImage src={W.prayer} alt="Years redeemed" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={W.closing} alt="Restoration of wholeness" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PURPOSE ZONES — Restoration of Purpose devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function PurposeZones({ project }: { project: Project }) {
  const ov = project.overlayColor;

  // Next Devotion chains across all projects in declared order:
  // residential → hospitality → wraps back to residential.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <>
      {/* ── Zone 1: Purpose Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.hero} alt="Purpose woven" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(5rem, 14vw, 16rem)', paddingBottom: '0.22em' }}
          data-speed="0.5"
        >
          Purpose
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s explore the chapters you cannot yet read, and the Author who wastes nothing.
        </div>
      </div>

      {/* ── Zone 2: The Hook ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--app-bg))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.8rem, 4.5vw, 4.5rem)' }}
          data-speed="0.5"
        >
          When your story has lost its plot.
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          There are seasons in life when nothing seems to make sense. The job loss that came out of nowhere. The relationship that fell apart despite every effort to save it. The illness that arrived uninvited and overstayed its welcome. In those seasons, purpose feels like the first thing to disappear.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.hookLeft} alt="Disorienting season" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          You start to wonder: What is the point of all this suffering? Is God doing anything with my pain, or am I just surviving for no reason? The most disorienting part of loss is not the loss itself&mdash;it is the feeling that your story has lost its plot. That the chapters are no longer building toward anything meaningful.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.hookRight} alt="Lost plot" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          Romans 8:28 is one of the most quoted&mdash;and most misunderstood&mdash;verses in the Bible. It is not a promise that everything that happens to us is good. Paul does not say &ldquo;all things are good.&rdquo; He says God works <em className="not-italic font-['Cormorant_Garamond'] italic">in</em> all things <em className="not-italic font-['Cormorant_Garamond'] italic">for</em> good. The distinction is critical. God is not the author of your suffering; He is the Redeemer of it.
        </div>

        {/* Gallery row */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.scripture1} alt="Fractured pieces" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.scripture2} alt="Synergy" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.scripture3} alt="Conformed" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          The word &ldquo;works&rdquo; here is the Greek word <em className="not-italic font-['Cormorant_Garamond'] italic">synergei</em>&mdash;from which we get the English word &ldquo;synergy.&rdquo; It suggests God actively collaborating with the circumstances of our lives, combining even the painful ones into a coherent, purposeful narrative. And notice the scope: not some things. <em className="not-italic font-['Cormorant_Garamond'] italic">All</em> things. The betrayal, the failure, the loss, the waiting&mdash;none of it is wasted in God&rsquo;s economy.
        </div>
      </div>

      {/* ── Zone 4: Conformed + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--app-bg))` }}>
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.principle1} alt="Image of his Son" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          Paul then reveals the ultimate purpose: to be &ldquo;conformed to the image of his Son.&rdquo; God&rsquo;s restoration of purpose is not about making our lives comfortable. It is about making us more like Christ. Every hard season is shaping something eternal in us.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.principle2} alt="Eternal shaping" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          God does not waste suffering.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The restoration of purpose does not mean every chapter will be painless&mdash;it means every chapter is being authored with intention. What feels like a meaningless detour in the moment is often the very road God uses to shape us into who He created us to be. Purpose is not found in the absence of hardship but in the presence of a God who redeems every broken piece.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.principle3} alt="Authored chapter" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Think of the season in your life that felt the most purposeless&mdash;the one where you wondered if God had forgotten the plot of your story. Now ask yourself: did anything good grow from that ground? A deeper compassion? A stronger faith? A relationship that would not have existed otherwise? God may not have caused the pain, but He has been working in it all along.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;God is always building something, even when we cannot see the blueprint.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.application1} alt="Surrendering to authorship" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.application2} alt="Watching for God" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          Today, take one area of your life that currently feels purposeless or painful and consciously surrender it to God&rsquo;s authorship. Say out loud: &ldquo;Lord, I do not understand this chapter. But I trust that You are working all things together for good. Restore my sense of purpose. Show me what You are building.&rdquo; And then watch.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.application3} alt="Blueprint unfolding" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Restoration
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          Father, I confess that I have questioned Your purposes. There are chapters in my story that I do not understand&mdash;seasons that felt wasted, pain that seemed pointless. But I choose today to trust that You are working in all things. Nothing in my life is outside Your reach or beyond Your ability to redeem. Restore my sense of purpose, Lord. Help me to see that even the hardest seasons are shaping me into the image of Your Son. I surrender the chapters I do not understand to You, the Author who wastes nothing. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Romans 8:28 &mdash; Restoration of Purpose
        </p>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={P.prayer} alt="Author of all things" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Purpose" overlayColor={ov} />

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   PURPOSE MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function PurposeMobile({ project }: { project: Project }) {
  const bg = project.overlayColor;
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--app-bg))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Purpose Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s explore the chapters you cannot yet read, and the Author who wastes nothing.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(4rem, 18vw, 10rem)', paddingBottom: '0.18em' }}
        >
          Purpose
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src={P.hero} alt="Purpose woven" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          When your story has lost its plot.
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          There are seasons in life when nothing seems to make sense. The job loss that came out of nowhere. The relationship that fell apart despite every effort to save it. The illness that arrived uninvited and overstayed its welcome. In those seasons, purpose feels like the first thing to disappear. You start to wonder: What is the point of all this suffering? Is God doing anything with my pain, or am I just surviving for no reason?
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          The most disorienting part of loss is not the loss itself&mdash;it is the feeling that your story has lost its plot. That the chapters are no longer building toward anything meaningful.
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Romans 8:28 is one of the most quoted&mdash;and most misunderstood&mdash;verses in the Bible. It is not a promise that everything that happens to us is good. Paul does not say &ldquo;all things are good.&rdquo; He says God works <em className="not-italic font-['Cormorant_Garamond'] italic">in</em> all things <em className="not-italic font-['Cormorant_Garamond'] italic">for</em> good. The distinction is critical. God is not the author of your suffering; He is the Redeemer of it.
        </p>
        <PhotoDevelopImage src={P.scripture1} alt="Fractured pieces" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          The word &ldquo;works&rdquo; here is the Greek word <em className="not-italic font-['Cormorant_Garamond'] italic">synergei</em>&mdash;from which we get the English word &ldquo;synergy.&rdquo; It suggests God actively collaborating with the circumstances of our lives, combining even the painful ones into a coherent, purposeful narrative. And notice the scope: not some things. All things. The betrayal, the failure, the loss, the waiting&mdash;none of it is wasted in God&rsquo;s economy.
        </p>
        <PhotoDevelopImage src={P.scripture2} alt="Synergy" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          Paul then reveals the ultimate purpose: to be &ldquo;conformed to the image of his Son.&rdquo; God&rsquo;s restoration of purpose is not about making our lives comfortable. It is about making us more like Christ. Every hard season is shaping something eternal in us.
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={P.hookLeft} alt="Disorienting season" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src={P.principle1} alt="Image of his Son" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          God does not waste suffering.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          The restoration of purpose does not mean every chapter will be painless&mdash;it means every chapter is being authored with intention. What feels like a meaningless detour in the moment is often the very road God uses to shape us into who He created us to be. Purpose is not found in the absence of hardship but in the presence of a God who redeems every broken piece.
        </p>
        <PhotoDevelopImage src={P.principle2} alt="Eternal shaping" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Think of the season in your life that felt the most purposeless&mdash;the one where you wondered if God had forgotten the plot of your story. Now ask yourself: did anything good grow from that ground? A deeper compassion? A stronger faith? A relationship that would not have existed otherwise? God may not have caused the pain, but He has been working in it all along.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;God is always building something, even when we cannot see the blueprint.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Today, take one area of your life that currently feels purposeless or painful and consciously surrender it to God&rsquo;s authorship. Say out loud: &ldquo;Lord, I do not understand this chapter. But I trust that You are working all things together for good. Restore my sense of purpose. Show me what You are building.&rdquo; And then watch.
        </p>
        <PhotoDevelopImage src={P.application1} alt="Surrendering to authorship" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Restoration</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          Father, I confess that I have questioned Your purposes. There are chapters in my story that I do not understand&mdash;seasons that felt wasted, pain that seemed pointless. But I choose today to trust that You are working in all things. Nothing in my life is outside Your reach or beyond Your ability to redeem. Restore my sense of purpose, Lord. Help me to see that even the hardest seasons are shaping me into the image of Your Son. I surrender the chapters I do not understand to You, the Author who wastes nothing. Amen.
        </p>
        <PhotoDevelopImage src={P.prayer} alt="Author of all things" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={P.closing} alt="Restoration of purpose" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   CONNECTION ZONES — Restoration of Connection devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function ConnectionZones({ project }: { project: Project }) {
  const ov = project.overlayColor;

  // Next Devotion chains across all projects in declared order:
  // residential → hospitality → wraps back to residential.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <>
      {/* ── Zone 1: Connection Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.hero} alt="Brought near" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(4rem, 12vw, 14rem)', paddingBottom: '0.22em' }}
          data-speed="0.5"
        >
          Connection
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s explore the wall already torn down, and the God who has brought you near.
        </div>
      </div>

      {/* ── Zone 2: The Hook ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--app-bg))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.8rem, 4.5vw, 4.5rem)' }}
          data-speed="0.5"
        >
          The disconnection that hurts the most.
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          Disconnection is one of the quiet epidemics of our time. We have more ways to reach each other than ever before&mdash;texts, calls, social media, video chats&mdash;and yet loneliness is at an all-time high. But the disconnection that hurts the most is not the distance between us and other people. It is the distance we feel between us and God.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.hookLeft} alt="Quiet distance" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          Maybe you used to feel close to Him. Maybe prayer used to come easily, worship used to move you, and Scripture used to feel alive. But somewhere along the way, a wall went up. Sin, disappointment, busyness, or pain quietly pushed you to the margins of God&rsquo;s presence. And now, when you try to reach Him, it feels like you are talking to the ceiling.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.hookRight} alt="Wall went up" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          Paul wrote to the Ephesians&mdash;a church made up largely of Gentiles, people who were historically outsiders to God&rsquo;s covenant promises. They had been, in Paul&rsquo;s words, &ldquo;far away.&rdquo; Excluded. Without hope. Without God. That was their spiritual r&eacute;sum&eacute; before Christ.
        </div>

        {/* Gallery row */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.scripture1} alt="Far away" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.scripture2} alt="But now" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.scripture3} alt="Wall destroyed" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          But then Paul uses two of the most powerful words in Scripture: &ldquo;But now.&rdquo; Everything changed. The distance was closed&mdash;not by human effort, not by religious performance, but by the blood of Christ. The dividing wall of hostility was destroyed. Access to God was no longer reserved for a select few; it was thrown wide open.
        </div>
      </div>

      {/* ── Zone 4: Brought Near + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--app-bg))` }}>
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.principle1} alt="Eggys — pulled close" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          The Greek word Paul uses for &ldquo;brought near&rdquo; is <em className="not-italic font-['Cormorant_Garamond'] italic">eggys</em>&mdash;the same word used to describe intimate proximity. God did not merely wave at them from a distance. He pulled them close. And He does the same for us. Every wall that sin erected, every chasm that shame carved out, every distance that disappointment created&mdash;Christ has bridged it all. You are not far from God. You have been brought near.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.principle2} alt="Bridged distance" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          You do not have to earn what Christ has already purchased.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          No amount of distance&mdash;whether caused by sin, seasons of spiritual dryness, or the pain of unanswered prayer&mdash;can disqualify us from the nearness God has already purchased. Restoration of connection with God does not require us to earn our way back into His presence. It requires us to accept the invitation that Christ&rsquo;s sacrifice has already extended.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.principle3} alt="Already extended" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          If you have felt far from God, today is the day you stop trying to close the distance on your own. You do not need to pray a perfect prayer, clean up your life first, or wait until you &ldquo;feel&rdquo; spiritual enough. Simply come.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;You are not an outsider. You are not too far gone. You have been brought near.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.application1} alt="Open Bible" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.application2} alt="Honest prayer" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          Open your Bible to Ephesians 2 and read it slowly. Speak to God honestly&mdash;tell Him where the distance started, where the wall went up. And then receive this truth: the blood of Christ has already done the work of bringing you near. You are not an outsider. You are not too far gone. You have been brought near&mdash;and nothing can push you back.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.application3} alt="Brought near" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Restoration
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          Lord, I have felt so far from You. I have let sin, shame, and silence build walls between us that I did not know how to tear down. But today I receive the truth that You have already torn them down through Christ. I do not have to earn my way back to You&mdash;I have been brought near by Your grace. Restore the closeness I have lost. Help me to live in the nearness You have already given me. I am done keeping my distance. I am coming home. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Ephesians 2:13 &mdash; Restoration of Connection
        </p>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={C.prayer} alt="Coming home" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Connection" overlayColor={ov} />

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   CONNECTION MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function ConnectionMobile({ project }: { project: Project }) {
  const bg = project.overlayColor;
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--app-bg))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Connection Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s explore the wall already torn down, and the God who has brought you near.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(3rem, 14vw, 8rem)', paddingBottom: '0.18em' }}
        >
          Connection
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src={C.hero} alt="Brought near" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          The disconnection that hurts the most.
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          Disconnection is one of the quiet epidemics of our time. We have more ways to reach each other than ever before&mdash;texts, calls, social media, video chats&mdash;and yet loneliness is at an all-time high. But the disconnection that hurts the most is not the distance between us and other people. It is the distance we feel between us and God.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          Maybe you used to feel close to Him. Maybe prayer used to come easily, worship used to move you, and Scripture used to feel alive. But somewhere along the way, a wall went up. Sin, disappointment, busyness, or pain quietly pushed you to the margins of God&rsquo;s presence. And now, when you try to reach Him, it feels like you are talking to the ceiling.
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Paul wrote to the Ephesians&mdash;a church made up largely of Gentiles, people who were historically outsiders to God&rsquo;s covenant promises. They had been, in Paul&rsquo;s words, &ldquo;far away.&rdquo; Excluded. Without hope. Without God. That was their spiritual r&eacute;sum&eacute; before Christ.
        </p>
        <PhotoDevelopImage src={C.scripture1} alt="Far away" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          But then Paul uses two of the most powerful words in Scripture: &ldquo;But now.&rdquo; Everything changed. The distance was closed&mdash;not by human effort, not by religious performance, but by the blood of Christ. The dividing wall of hostility was destroyed. Access to God was no longer reserved for a select few; it was thrown wide open.
        </p>
        <PhotoDevelopImage src={C.scripture2} alt="But now" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          The Greek word Paul uses for &ldquo;brought near&rdquo; is <em className="not-italic font-['Cormorant_Garamond'] italic">eggys</em>&mdash;the same word used to describe intimate proximity. God did not merely wave at them from a distance. He pulled them close. And He does the same for us. Every wall that sin erected, every chasm that shame carved out, every distance that disappointment created&mdash;Christ has bridged it all.
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={C.hookLeft} alt="Quiet distance" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src={C.principle1} alt="Eggys" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          You do not have to earn what Christ has already purchased.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          No amount of distance&mdash;whether caused by sin, seasons of spiritual dryness, or the pain of unanswered prayer&mdash;can disqualify us from the nearness God has already purchased. Restoration of connection with God does not require us to earn our way back into His presence. It requires us to accept the invitation that Christ&rsquo;s sacrifice has already extended.
        </p>
        <PhotoDevelopImage src={C.principle2} alt="Bridged distance" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          If you have felt far from God, today is the day you stop trying to close the distance on your own. You do not need to pray a perfect prayer, clean up your life first, or wait until you &ldquo;feel&rdquo; spiritual enough. Simply come.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;You are not an outsider. You are not too far gone. You have been brought near.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Open your Bible to Ephesians 2 and read it slowly. Speak to God honestly&mdash;tell Him where the distance started, where the wall went up. And then receive this truth: the blood of Christ has already done the work of bringing you near. You are not an outsider. You are not too far gone. You have been brought near&mdash;and nothing can push you back.
        </p>
        <PhotoDevelopImage src={C.application1} alt="Open Bible" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Restoration</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          Lord, I have felt so far from You. I have let sin, shame, and silence build walls between us that I did not know how to tear down. But today I receive the truth that You have already torn them down through Christ. I do not have to earn my way back to You&mdash;I have been brought near by Your grace. Restore the closeness I have lost. Help me to live in the nearness You have already given me. I am done keeping my distance. I am coming home. Amen.
        </p>
        <PhotoDevelopImage src={C.prayer} alt="Coming home" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={C.closing} alt="Restoration of connection" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   IDENTITY ZONES — Restoration of Identity devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function IdentityZones({ project }: { project: Project }) {
  const ov = project.overlayColor;

  // Next Devotion chains across all projects in declared order:
  // residential → hospitality → wraps back to residential.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <>
      {/* ── Zone 1: Identity Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.hero} alt="New creation" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(4rem, 12vw, 14rem)', paddingBottom: '0.22em' }}
          data-speed="0.5"
        >
          Identity
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s explore the labels you no longer have to answer to, and the new name God has already given you.
        </div>
      </div>

      {/* ── Zone 2: The Hook ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--app-bg))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.8rem, 4.5vw, 4.5rem)' }}
          data-speed="0.5"
        >
          The labels no one else sees.
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          How do you introduce yourself? Most of us lead with what we do, where we&rsquo;re from, or who we&rsquo;re connected to. But if we&rsquo;re honest, the way we define ourselves in private is often far less polished. In the quiet of our own minds, we carry a different set of labels&mdash;the ones no one else sees. The addict. The failure. The one who can&rsquo;t keep it together. The one who was abandoned. The one who isn&rsquo;t enough.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.hookLeft} alt="Quiet labels" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          These internal labels become load-bearing walls in our lives. They shape our decisions, our relationships, and our willingness to step into the calling God has placed on us. And the most damaging part? We often mistake them for truth. We believe the old story so deeply that it starts to feel like the only story we&rsquo;ll ever have.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.hookRight} alt="Old story" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          Paul wrote these words to the church in Corinth&mdash;a community of former idol worshippers, former prostitutes, former thieves, and former liars who were struggling to leave their old identities behind. The culture kept pulling them back toward who they used to be. And Paul&rsquo;s response is one of the most radical declarations in all of Scripture.
        </div>

        {/* Gallery row */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.scripture1} alt="Old creation" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.scripture2} alt="The new is here" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.scripture3} alt="Replaced" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          Notice that Paul doesn&rsquo;t say the new creation <em className="not-italic font-['Cormorant_Garamond'] italic">is coming</em>. He doesn&rsquo;t say it&rsquo;s a goal to work toward. He says it <em className="not-italic font-['Cormorant_Garamond'] italic">has come</em>. In Christ, the transformation is already accomplished. Your old identity&mdash;the one built on shame, regret, and the labels the world gave you&mdash;has been replaced. Not improved. Not upgraded. <em className="not-italic font-['Cormorant_Garamond'] italic">Replaced</em>.
        </div>
      </div>

      {/* ── Zone 4: Reconciled + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--app-bg))` }}>
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.principle1} alt="Reconciled" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          And the source of this new identity? Paul tells us: &ldquo;All this is from God, who reconciled us to himself through Christ.&rdquo; The restoration of your identity is not something you manufacture through self-help or willpower. It is a gift from the God who looked at your brokenness and said, &ldquo;I&rsquo;m not counting that against you. I&rsquo;m making you new.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.principle2} alt="Made new" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          Your past does not get the final word over who you are.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          In Christ, your identity is no longer defined by your past. Restoration of identity means that who you were and what was done to you no longer get the final word over who you are. You have been reconciled&mdash;brought back into right relationship with God&mdash;and in that reconciliation, you have been given a completely new name. The old labels have been stripped away. The new creation has already begun.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.principle3} alt="New name" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Today, identify one label you&rsquo;ve been carrying that does not align with who God says you are. Maybe it&rsquo;s &ldquo;unworthy.&rdquo; Maybe it&rsquo;s &ldquo;beyond repair.&rdquo; Maybe it&rsquo;s the name of a sin you left behind years ago but still secretly answer to. Write it down. And then cross it out.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;I am a new creation. The old is gone. The new is here.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.application1} alt="Crossing out the label" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.application2} alt="The new name" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          Write over it the truth of 2 Corinthians 5:17: &ldquo;I am a new creation. The old is gone. The new is here.&rdquo; Put this where you will see it every morning this week. Every time the old label tries to reassert itself, speak the new one out loud. You are not who you were. You are who God says you are. And He says you are new.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.application3} alt="Spoken out loud" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Restoration
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          God, I have been carrying labels that were never Yours to give. I&rsquo;ve let my past define me, and I&rsquo;ve answered to names that You never called me. Today, I lay them down. I receive the identity You have given me in Christ: new creation, reconciled, beloved. Help me to live from this truth and not from the old story. When the old labels try to pull me back, anchor me in the reality of who I am in You. The old has gone. The new is here. Thank You for making me whole again. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          2 Corinthians 5:17 &mdash; Restoration of Identity
        </p>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={I.prayer} alt="Beloved" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Identity" overlayColor={ov} />

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   IDENTITY MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function IdentityMobile({ project }: { project: Project }) {
  const bg = project.overlayColor;
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--app-bg))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Identity Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s explore the labels you no longer have to answer to, and the new name God has already given you.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(3rem, 14vw, 8rem)', paddingBottom: '0.18em' }}
        >
          Identity
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src={I.hero} alt="New creation" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          The labels no one else sees.
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          How do you introduce yourself? Most of us lead with what we do, where we&rsquo;re from, or who we&rsquo;re connected to. But if we&rsquo;re honest, the way we define ourselves in private is often far less polished. In the quiet of our own minds, we carry a different set of labels&mdash;the ones no one else sees. The addict. The failure. The one who can&rsquo;t keep it together. The one who was abandoned. The one who isn&rsquo;t enough.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          These internal labels become load-bearing walls in our lives. They shape our decisions, our relationships, and our willingness to step into the calling God has placed on us. And the most damaging part? We often mistake them for truth. We believe the old story so deeply that it starts to feel like the only story we&rsquo;ll ever have.
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Paul wrote these words to the church in Corinth&mdash;a community of former idol worshippers, former prostitutes, former thieves, and former liars who were struggling to leave their old identities behind. The culture kept pulling them back toward who they used to be. And Paul&rsquo;s response is one of the most radical declarations in all of Scripture.
        </p>
        <PhotoDevelopImage src={I.scripture1} alt="Old creation" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Notice that Paul doesn&rsquo;t say the new creation <em className="not-italic font-['Cormorant_Garamond'] italic">is coming</em>. He doesn&rsquo;t say it&rsquo;s a goal to work toward. He says it <em className="not-italic font-['Cormorant_Garamond'] italic">has come</em>. In Christ, the transformation is already accomplished. Your old identity&mdash;the one built on shame, regret, and the labels the world gave you&mdash;has been replaced. Not improved. Not upgraded. <em className="not-italic font-['Cormorant_Garamond'] italic">Replaced</em>.
        </p>
        <PhotoDevelopImage src={I.scripture2} alt="The new is here" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          And the source of this new identity? Paul tells us: &ldquo;All this is from God, who reconciled us to himself through Christ.&rdquo; The restoration of your identity is not something you manufacture through self-help or willpower. It is a gift from the God who looked at your brokenness and said, &ldquo;I&rsquo;m not counting that against you. I&rsquo;m making you new.&rdquo;
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={I.hookLeft} alt="Quiet labels" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src={I.principle1} alt="Reconciled" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          Your past does not get the final word over who you are.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          In Christ, your identity is no longer defined by your past. Restoration of identity means that who you were and what was done to you no longer get the final word over who you are. You have been reconciled&mdash;brought back into right relationship with God&mdash;and in that reconciliation, you have been given a completely new name. The old labels have been stripped away. The new creation has already begun.
        </p>
        <PhotoDevelopImage src={I.principle2} alt="Made new" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Today, identify one label you&rsquo;ve been carrying that does not align with who God says you are. Maybe it&rsquo;s &ldquo;unworthy.&rdquo; Maybe it&rsquo;s &ldquo;beyond repair.&rdquo; Maybe it&rsquo;s the name of a sin you left behind years ago but still secretly answer to. Write it down. And then cross it out.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;I am a new creation. The old is gone. The new is here.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Write over it the truth of 2 Corinthians 5:17: &ldquo;I am a new creation. The old is gone. The new is here.&rdquo; Put this where you will see it every morning this week. Every time the old label tries to reassert itself, speak the new one out loud. You are not who you were. You are who God says you are. And He says you are new.
        </p>
        <PhotoDevelopImage src={I.application1} alt="Crossing out the label" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Restoration</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          God, I have been carrying labels that were never Yours to give. I&rsquo;ve let my past define me, and I&rsquo;ve answered to names that You never called me. Today, I lay them down. I receive the identity You have given me in Christ: new creation, reconciled, beloved. Help me to live from this truth and not from the old story. When the old labels try to pull me back, anchor me in the reality of who I am in You. The old has gone. The new is here. Thank You for making me whole again. Amen.
        </p>
        <PhotoDevelopImage src={I.prayer} alt="Beloved" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={I.closing} alt="Restoration of identity" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   JOY ZONES — Restoration of Joy devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function JoyZones({ project }: { project: Project }) {
  const ov = project.overlayColor;

  // Next Devotion chains across all projects in declared order:
  // residential → hospitality → wraps back to residential.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <>
      {/* ── Zone 1: Joy Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.hero} alt="Streams in the Negev" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(5rem, 14vw, 16rem)', paddingBottom: '0.22em' }}
          data-speed="0.5"
        >
          Joy
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s explore the harvest of singing that grows in the soil of tears.
        </div>
      </div>

      {/* ── Zone 2: The Hook ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--app-bg))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.8rem, 4.5vw, 4.5rem)' }}
          data-speed="0.5"
        >
          When was the last time you really laughed?
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          Can you remember the last time you laughed&mdash;really laughed? Not a polite chuckle or a quick smile at a text, but the kind of laughter that comes from somewhere deep, the kind that makes your eyes water and your chest ache in the best way? For some of us, that kind of joy feels like it belongs to a different version of ourselves&mdash;the person we were before the diagnosis, before the divorce, before the season that stripped us down to the studs.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.hookLeft} alt="Color draining" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          Joy is one of the first casualties of prolonged hardship. It doesn&rsquo;t leave all at once. It fades slowly, like color draining from a photograph, until one day you realize you can&rsquo;t remember what it felt like to be light. And you begin to wonder: will it ever come back?
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.hookRight} alt="Faded photograph" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          Psalm 126 is a song written by the Israelites after they returned from decades of exile in Babylon. For seventy years, they had lived as captives in a foreign land, stripped of their homeland, their temple, and their way of life. And then, almost impossibly, God brought them home. The psalmist describes that moment of return with breathtaking language: &ldquo;We were like those who dreamed.&rdquo;
        </div>

        {/* Gallery row */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.scripture1} alt="Like those who dreamed" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.scripture2} alt="Mouth-filling joy" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.scripture3} alt="Songs of joy" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          And what was the first sign of their restoration? Laughter. Songs of joy. Not careful optimism. Not cautious gratitude. Uncontainable, overflowing, mouth-filling joy. Even the surrounding nations took notice and said, &ldquo;The Lord has done great things for them.&rdquo;
        </div>
      </div>

      {/* ── Zone 4: Streams in the Negev + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--app-bg))` }}>
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.principle1} alt="Wadis flowing" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          But the psalm doesn&rsquo;t end there. The writer then shifts to a prayer: &ldquo;Restore our fortunes, Lord, like streams in the Negev.&rdquo; The Negev is the southern desert of Israel&mdash;dry, barren, seemingly lifeless. But when the rains come, dry riverbeds called <em className="not-italic font-['Cormorant_Garamond'] italic">wadis</em> suddenly rush with water, and the desert blooms almost overnight. That is the image God gives us for restored joy: what looks completely dead can burst to life in a single season of His faithfulness.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.principle2} alt="Desert blooms" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          The season of weeping is not the final chapter.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          God does not waste our tears&mdash;He transforms them into a harvest. Restored joy is not the absence of sorrow; it is the gift that grows in the very soil that sorrow tilled. The tears we shed in our hardest seasons are seeds, and God promises that every one of them will yield a return of singing.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.principle3} alt="Harvest of singing" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          If joy has become a stranger to you, know this: its absence is not permanent. God is in the business of turning deserts into rivers and weeping into singing. Today, take one small step back toward joy. Put on a song that used to make your spirit come alive. Call someone who makes you laugh. Step outside and feel the sun on your face.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;The harvest is coming.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.application1} alt="Song that comes alive" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.application2} alt="Sun on your face" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          These are not trivial acts&mdash;they are acts of faith, declaring that the season of sowing tears is giving way to the season of reaping songs. And if you&rsquo;re not there yet, if the tears are still falling, hold on to the promise: &ldquo;Those who go out weeping, carrying seed to sow, will return with songs of joy, carrying sheaves with them.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.application3} alt="Carrying sheaves" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Restoration
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          Lord, I have been living in a dry season. Joy feels distant, and laughter feels foreign. But I know that You are the God who sends streams through the desert. I bring You my tears today&mdash;not as evidence of defeat, but as seeds of faith. I trust that You will turn my mourning into dancing and fill my mouth with laughter again. Restore the joy of my salvation, Lord. Let the nations&mdash;and my own weary heart&mdash;see what You have done. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Psalm 126:1&ndash;2 &mdash; Restoration of Joy
        </p>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={J.prayer} alt="Mourning into dancing" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Joy" overlayColor={ov} />

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   JOY MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function JoyMobile({ project }: { project: Project }) {
  const bg = project.overlayColor;
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--app-bg))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Joy Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s explore the harvest of singing that grows in the soil of tears.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(4rem, 18vw, 10rem)', paddingBottom: '0.18em' }}
        >
          Joy
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src={J.hero} alt="Streams in the Negev" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          When was the last time you really laughed?
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          Can you remember the last time you laughed&mdash;really laughed? Not a polite chuckle or a quick smile at a text, but the kind of laughter that comes from somewhere deep, the kind that makes your eyes water and your chest ache in the best way? For some of us, that kind of joy feels like it belongs to a different version of ourselves&mdash;the person we were before the diagnosis, before the divorce, before the season that stripped us down to the studs.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          Joy is one of the first casualties of prolonged hardship. It doesn&rsquo;t leave all at once. It fades slowly, like color draining from a photograph, until one day you realize you can&rsquo;t remember what it felt like to be light. And you begin to wonder: will it ever come back?
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Psalm 126 is a song written by the Israelites after they returned from decades of exile in Babylon. For seventy years, they had lived as captives in a foreign land, stripped of their homeland, their temple, and their way of life. And then, almost impossibly, God brought them home. The psalmist describes that moment of return with breathtaking language: &ldquo;We were like those who dreamed.&rdquo;
        </p>
        <PhotoDevelopImage src={J.scripture1} alt="Like those who dreamed" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          And what was the first sign of their restoration? Laughter. Songs of joy. Not careful optimism. Not cautious gratitude. Uncontainable, overflowing, mouth-filling joy. Even the surrounding nations took notice and said, &ldquo;The Lord has done great things for them.&rdquo;
        </p>
        <PhotoDevelopImage src={J.scripture2} alt="Mouth-filling joy" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          But the psalm doesn&rsquo;t end there. The writer shifts to a prayer: &ldquo;Restore our fortunes, Lord, like streams in the Negev.&rdquo; The Negev is the southern desert of Israel&mdash;dry, barren, seemingly lifeless. But when the rains come, dry riverbeds called <em className="not-italic font-['Cormorant_Garamond'] italic">wadis</em> suddenly rush with water, and the desert blooms almost overnight.
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={J.hookLeft} alt="Color draining" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src={J.principle1} alt="Wadis flowing" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          The season of weeping is not the final chapter.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          God does not waste our tears&mdash;He transforms them into a harvest. Restored joy is not the absence of sorrow; it is the gift that grows in the very soil that sorrow tilled. The tears we shed in our hardest seasons are seeds, and God promises that every one of them will yield a return of singing.
        </p>
        <PhotoDevelopImage src={J.principle2} alt="Desert blooms" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          If joy has become a stranger to you, know this: its absence is not permanent. God is in the business of turning deserts into rivers and weeping into singing. Today, take one small step back toward joy. Put on a song that used to make your spirit come alive. Call someone who makes you laugh. Step outside and feel the sun on your face.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;The harvest is coming.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          These are not trivial acts&mdash;they are acts of faith, declaring that the season of sowing tears is giving way to the season of reaping songs. And if you&rsquo;re not there yet, if the tears are still falling, hold on to the promise: &ldquo;Those who go out weeping, carrying seed to sow, will return with songs of joy, carrying sheaves with them.&rdquo;
        </p>
        <PhotoDevelopImage src={J.application1} alt="Song that comes alive" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Restoration</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          Lord, I have been living in a dry season. Joy feels distant, and laughter feels foreign. But I know that You are the God who sends streams through the desert. I bring You my tears today&mdash;not as evidence of defeat, but as seeds of faith. I trust that You will turn my mourning into dancing and fill my mouth with laughter again. Restore the joy of my salvation, Lord. Let the nations&mdash;and my own weary heart&mdash;see what You have done. Amen.
        </p>
        <PhotoDevelopImage src={J.prayer} alt="Mourning into dancing" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={J.closing} alt="Restoration of joy" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   FORGIVENESS ZONES — Serenity of Forgiveness devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function ForgivenessZones({ project }: { project: Project }) {
  const ov = project.overlayColor;

  // Next Devotion chains across all projects in declared order:
  // residential → hospitality → wraps back to residential.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <>
      {/* ── Zone 1: Forgiveness Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.hero} alt="Open hands" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(3.5rem, 11vw, 13rem)', paddingBottom: '0.22em' }}
          data-speed="0.5"
        >
          Forgiveness
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s explore the weight you were never meant to carry, and the hands open enough to let it fall.
        </div>
      </div>

      {/* ── Zone 2: The Hook ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--app-bg))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.5rem, 3.8vw, 3.8rem)' }}
          data-speed="0.5"
        >
          Some wounds are loud. Others are quiet but just as deep.
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          Maybe someone said something about you that was never true, and the memory still burns. Maybe a parent was harsh where they should have been tender, and you have been explaining it away for years. Maybe a friend walked out when you needed them most, and you have promised yourself you will never be that vulnerable again.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.hookLeft} alt="Quiet wound" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          We tell ourselves that holding on to the offense is a way of protecting ourselves. But somewhere along the way, the weight we thought we were carrying to stay safe starts carrying us instead. Bitterness has a way of doing that. It promises justice and delivers exhaustion. It promises power and delivers a restless, agitated soul.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.hookRight} alt="Carried weight" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          Paul wrote the letter to the Ephesians from prison. He was writing to a mixed community of Jews and Gentiles who carried real grievances against one another&mdash;histories of exclusion, misunderstanding, and hurt. He does not minimize what they have felt. But he does call them to lay it down.
        </div>

        {/* Gallery row */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.scripture1} alt="Real grievances" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.scripture2} alt="Lift and carry away" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.scripture3} alt="Sacred release" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          The Greek word translated &ldquo;get rid of&rdquo; is <em className="not-italic font-['Cormorant_Garamond'] italic">airo</em>, which means to lift up and carry away. Paul is describing a deliberate, active release. This is not repression. It is not pretending the wound didn&rsquo;t happen. It is the sacred work of choosing not to keep rehearsing it.
        </div>
      </div>

      {/* ── Zone 4: Just as in Christ + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--app-bg))` }}>
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.principle1} alt="The cross absorbs" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          And Paul anchors it in something beautiful: &ldquo;just as in Christ God forgave you.&rdquo; We do not forgive from a place of moral superiority. We forgive from a place of having been forgiven. The cross is the deepest possible proof that our offenses were absorbed by a love that refused to pass the debt back to us. When we forgive, we are not being asked to manufacture something we don&rsquo;t have. We are being asked to give away what we have already received.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.principle2} alt="Already received" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          The thing you thought you were holding onto was holding onto you.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          Serenity is impossible to hold on to while bitterness is being nursed. Forgiveness is not a statement that the wound did not matter; it is a refusal to let the wound keep writing the next chapter of our lives. When we release the offense into the hands of a God who sees what we cannot fix, we discover that the thing we thought we needed to hold onto was actually the thing holding onto us.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.principle3} alt="Released into His hands" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Bring one specific person and one specific offense to mind. Don&rsquo;t generalize&mdash;be honest about the name and the wound. Now imagine that offense as a weight in your hands. Forgiveness does not mean saying it didn&rsquo;t hurt. It means choosing to open your hands and let it fall.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;Your healing does not depend on their apology. It depends on your willingness to let Jesus carry what you were never meant to carry.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.application1} alt="Open your hands" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.application2} alt="Let it fall" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          You may need to do this more than once. You may need to do it every morning for a while. That is not weakness&mdash;that is how forgiveness actually works. If the person is safe and reconciliation is possible, ask God if there is a conversation He wants you to have. If the relationship is unsafe or no longer accessible, know this: your healing does not depend on their apology.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.application3} alt="Carried by Jesus" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Serenity
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          Lord, You know the name and the wound without me having to explain it. You have seen every moment of it. Today, I bring it to You&mdash;not because it didn&rsquo;t matter, but because I am tired of letting it define me. Help me to release what I have been holding. Teach me to forgive from the deep well of Your own forgiveness toward me. Cleanse me of bitterness. Soften what has hardened. Restore the serenity that only an unburdened heart can know. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Ephesians 4:31&ndash;32 &mdash; Serenity of Forgiveness
        </p>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={F.prayer} alt="Unburdened heart" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Serenity" overlayColor={ov} />

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   FORGIVENESS MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function ForgivenessMobile({ project }: { project: Project }) {
  const bg = project.overlayColor;
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--app-bg))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Forgiveness Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s explore the weight you were never meant to carry, and the hands open enough to let it fall.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(2.5rem, 12vw, 7rem)', paddingBottom: '0.18em' }}
        >
          Forgiveness
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src={F.hero} alt="Open hands" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          Some wounds are loud. Others are quiet but just as deep.
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          Maybe someone said something about you that was never true, and the memory still burns. Maybe a parent was harsh where they should have been tender, and you have been explaining it away for years. Maybe a friend walked out when you needed them most, and you have promised yourself you will never be that vulnerable again.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          We tell ourselves that holding on to the offense is a way of protecting ourselves. But somewhere along the way, the weight we thought we were carrying to stay safe starts carrying us instead. Bitterness has a way of doing that. It promises justice and delivers exhaustion. It promises power and delivers a restless, agitated soul.
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Paul wrote the letter to the Ephesians from prison. He was writing to a mixed community of Jews and Gentiles who carried real grievances against one another&mdash;histories of exclusion, misunderstanding, and hurt. He does not minimize what they have felt. But he does call them to lay it down.
        </p>
        <PhotoDevelopImage src={F.scripture1} alt="Real grievances" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          The Greek word translated &ldquo;get rid of&rdquo; is <em className="not-italic font-['Cormorant_Garamond'] italic">airo</em>, which means to lift up and carry away. Paul is describing a deliberate, active release. This is not repression. It is not pretending the wound didn&rsquo;t happen. It is the sacred work of choosing not to keep rehearsing it.
        </p>
        <PhotoDevelopImage src={F.scripture2} alt="Lift and carry away" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          And Paul anchors it in something beautiful: &ldquo;just as in Christ God forgave you.&rdquo; We do not forgive from a place of moral superiority. We forgive from a place of having been forgiven. The cross is the deepest possible proof that our offenses were absorbed by a love that refused to pass the debt back to us. When we forgive, we are not being asked to manufacture something we don&rsquo;t have. We are being asked to give away what we have already received.
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={F.hookLeft} alt="Quiet wound" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src={F.principle1} alt="The cross absorbs" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          The thing you thought you were holding onto was holding onto you.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Serenity is impossible to hold on to while bitterness is being nursed. Forgiveness is not a statement that the wound did not matter; it is a refusal to let the wound keep writing the next chapter of our lives. When we release the offense into the hands of a God who sees what we cannot fix, we discover that the thing we thought we needed to hold onto was actually the thing holding onto us.
        </p>
        <PhotoDevelopImage src={F.principle2} alt="Already received" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Bring one specific person and one specific offense to mind. Don&rsquo;t generalize&mdash;be honest about the name and the wound. Now imagine that offense as a weight in your hands. Forgiveness does not mean saying it didn&rsquo;t hurt. It means choosing to open your hands and let it fall.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;Your healing does not depend on their apology. It depends on your willingness to let Jesus carry what you were never meant to carry.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          You may need to do this more than once. You may need to do it every morning for a while. That is not weakness&mdash;that is how forgiveness actually works. If the person is safe and reconciliation is possible, ask God if there is a conversation He wants you to have. If the relationship is unsafe or no longer accessible, know this: your healing does not depend on their apology.
        </p>
        <PhotoDevelopImage src={F.application1} alt="Open your hands" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Serenity</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          Lord, You know the name and the wound without me having to explain it. You have seen every moment of it. Today, I bring it to You&mdash;not because it didn&rsquo;t matter, but because I am tired of letting it define me. Help me to release what I have been holding. Teach me to forgive from the deep well of Your own forgiveness toward me. Cleanse me of bitterness. Soften what has hardened. Restore the serenity that only an unburdened heart can know. Amen.
        </p>
        <PhotoDevelopImage src={F.prayer} alt="Unburdened heart" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={F.closing} alt="Serenity of forgiveness" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SURRENDER ZONES — Serenity of Surrender devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function SurrenderZones({ project }: { project: Project }) {
  const ov = project.overlayColor;

  // Next Devotion chains across all projects in declared order.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <>
      {/* ── Zone 1: Surrender Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.hero} alt="Be still" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(3.5rem, 11vw, 13rem)', paddingBottom: '0.22em' }}
          data-speed="0.5"
        >
          Surrender
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s explore the open hands that come after the white-knuckled fists.
        </div>
      </div>

      {/* ── Zone 2: The Hook ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--app-bg))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.5rem, 3.8vw, 3.8rem)' }}
          data-speed="0.5"
        >
          Serenity has never been the fruit of control.
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          There is a particular kind of restlessness that modern life breeds. It is the hum beneath our thoughts, the compulsion to check our phones one more time, the inability to sit in silence without reaching for a distraction. Even in our quietest moments, our minds are often loud&mdash;replaying conversations, rehearsing tomorrow&rsquo;s worries, and cataloging everything that feels out of our control.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.hookLeft} alt="Restless hum" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          We long for serenity, but we keep trying to manufacture it through control. If we can just answer every email, solve every problem, anticipate every outcome&mdash;then, we tell ourselves, we will finally feel at peace. But serenity has never been the fruit of control. It is the fruit of surrender.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.hookRight} alt="Hands that won't let go" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          Psalm 46 was written against the backdrop of catastrophe. The psalmist describes mountains falling into the heart of the sea, waters roaring and foaming, kingdoms shaking. This is not a psalm composed in a quiet garden on a sunny afternoon. It is a psalm born in the middle of upheaval. And yet, in the midst of that chaos, God speaks a single command: &ldquo;Be still, and know that I am God.&rdquo;
        </div>

        {/* Gallery row */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.scripture1} alt="Mountains falling" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.scripture2} alt="Waters roaring" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.scripture3} alt="Cease striving" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          The Hebrew phrase translated &ldquo;be still&rdquo; is <em className="not-italic font-['Cormorant_Garamond'] italic">raphah</em>, which carries the meaning of &ldquo;to let go&rdquo; or &ldquo;to cease striving.&rdquo; It is not simply an invitation to silence. It is a command to release your grip. To stop trying to hold the world together with your own two hands.
        </div>
      </div>

      {/* ── Zone 4: God's Sovereignty + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--app-bg))` }}>
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.principle1} alt="White-knuckled fists" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          To relax the white-knuckled fists you have been clenching for far too long. And the reason given is not that the storm has passed&mdash;but that God is still God. His sovereignty has not been shaken by anything that is shaking you.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.principle2} alt="Sovereignty unshaken" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          True peace begins where our striving ends.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          Serenity is not found by controlling our circumstances; it is found by surrendering them to the God who is already in control. When we release our grip on what we were never meant to carry, we discover that God has been holding it&mdash;and us&mdash;all along.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.principle3} alt="Held all along" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Consider the tight grip you have been keeping on something today. Perhaps it is a relationship you are trying to fix, a future you are trying to secure, or an outcome you are trying to force. Name it honestly before God. Then, as a physical act of surrender, open your hands&mdash;palms up&mdash;and whisper the words of the psalm: &ldquo;Be still, and know that I am God.&rdquo;
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;Let your body preach to your soul what your mind has been slow to believe.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.application1} alt="Open hands, palms up" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.application2} alt="Whispered psalm" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          Let your body preach to your soul what your mind has been slow to believe. Serenity is not an emotion you conjure. It is a gift that flows from trusting the One who holds all things together.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.application3} alt="All things held" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Serenity
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          Father, I confess that I have been striving when I should have been surrendering. I have been gripping tightly to things that were never mine to control. Today, I release them into Your hands. Quiet the noise in my mind. Settle the unrest in my spirit. Help me to be still long enough to remember that You are God&mdash;and that is enough. Fill me with the serenity that only comes from trusting You. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Psalm 46:10 &mdash; Serenity of Surrender
        </p>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={Su.prayer} alt="That is enough" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Serenity" overlayColor={ov} />

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   SURRENDER MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function SurrenderMobile({ project }: { project: Project }) {
  const bg = project.overlayColor;
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--app-bg))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Surrender Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s explore the open hands that come after the white-knuckled fists.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(2.5rem, 12vw, 7rem)', paddingBottom: '0.18em' }}
        >
          Surrender
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src={Su.hero} alt="Be still" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          Serenity has never been the fruit of control.
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          There is a particular kind of restlessness that modern life breeds. It is the hum beneath our thoughts, the compulsion to check our phones one more time, the inability to sit in silence without reaching for a distraction. Even in our quietest moments, our minds are often loud&mdash;replaying conversations, rehearsing tomorrow&rsquo;s worries, and cataloging everything that feels out of our control.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          We long for serenity, but we keep trying to manufacture it through control. If we can just answer every email, solve every problem, anticipate every outcome&mdash;then, we tell ourselves, we will finally feel at peace. But serenity has never been the fruit of control. It is the fruit of surrender.
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Psalm 46 was written against the backdrop of catastrophe. The psalmist describes mountains falling into the heart of the sea, waters roaring and foaming, kingdoms shaking. This is not a psalm composed in a quiet garden on a sunny afternoon. It is a psalm born in the middle of upheaval. And yet, in the midst of that chaos, God speaks a single command: &ldquo;Be still, and know that I am God.&rdquo;
        </p>
        <PhotoDevelopImage src={Su.scripture1} alt="Mountains falling" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          The Hebrew phrase translated &ldquo;be still&rdquo; is <em className="not-italic font-['Cormorant_Garamond'] italic">raphah</em>, which carries the meaning of &ldquo;to let go&rdquo; or &ldquo;to cease striving.&rdquo; It is not simply an invitation to silence. It is a command to release your grip. To stop trying to hold the world together with your own two hands. To relax the white-knuckled fists you have been clenching for far too long.
        </p>
        <PhotoDevelopImage src={Su.scripture2} alt="Waters roaring" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          And the reason given is not that the storm has passed&mdash;but that God is still God. His sovereignty has not been shaken by anything that is shaking you.
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={Su.hookLeft} alt="Restless hum" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src={Su.principle1} alt="White-knuckled fists" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          True peace begins where our striving ends.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Serenity is not found by controlling our circumstances; it is found by surrendering them to the God who is already in control. When we release our grip on what we were never meant to carry, we discover that God has been holding it&mdash;and us&mdash;all along.
        </p>
        <PhotoDevelopImage src={Su.principle2} alt="Sovereignty unshaken" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Consider the tight grip you have been keeping on something today. Perhaps it is a relationship you are trying to fix, a future you are trying to secure, or an outcome you are trying to force. Name it honestly before God. Then, as a physical act of surrender, open your hands&mdash;palms up&mdash;and whisper the words of the psalm: &ldquo;Be still, and know that I am God.&rdquo;
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;Let your body preach to your soul what your mind has been slow to believe.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Serenity is not an emotion you conjure. It is a gift that flows from trusting the One who holds all things together.
        </p>
        <PhotoDevelopImage src={Su.application1} alt="Open hands, palms up" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Serenity</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          Father, I confess that I have been striving when I should have been surrendering. I have been gripping tightly to things that were never mine to control. Today, I release them into Your hands. Quiet the noise in my mind. Settle the unrest in my spirit. Help me to be still long enough to remember that You are God&mdash;and that is enough. Fill me with the serenity that only comes from trusting You. Amen.
        </p>
        <PhotoDevelopImage src={Su.prayer} alt="That is enough" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={Su.closing} alt="Serenity of surrender" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TRUST ZONES — Serenity of Trust devotional (desktop)
   ════════════════════════════════════════════════════════════════ */

function TrustZones({ project }: { project: Project }) {
  const ov = project.overlayColor;

  // Next Devotion chains across all projects in declared order.
  const currentIndex = projects.findIndex(p => p.id === project.id);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <>
      {/* ── Zone 1: Trust Title ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '120vw' }}>
        <div
          className="mb-elem absolute top-[10%] left-[5%] w-[42vw] h-[78vh] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.hero} alt="The path made straight" className="w-full h-full" threshold={0.05} />
        </div>

        <h2
          className="mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white"
          style={{ fontSize: 'clamp(5rem, 14vw, 16rem)', paddingBottom: '0.22em' }}
          data-speed="0.5"
        >
          Trust
        </h2>

        <div
          className="mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70"
          data-speed="0.5"
        >
          Let&rsquo;s explore the weight you were never meant to carry on your own understanding.
        </div>
      </div>

      {/* ── Zone 2: The Hook ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 80%, var(--app-bg))` }}>
        <h3
          className="mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]"
          style={{ fontSize: 'clamp(1.5rem, 3.8vw, 3.8rem)' }}
          data-speed="0.5"
        >
          The heart was never designed to carry the weight of knowing everything.
        </h3>

        <div
          className="mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          Most of us are not struggling with whether God exists. We are struggling with whether God can be trusted with the specific, tender, uncertain parts of our lives. The decision that feels too big. The child we cannot fix. The diagnosis we did not see coming. The door that will not open no matter how hard we knock.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 left-[28%] w-[50vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.hookLeft} alt="Midnight uncertainty" className="w-full h-full object-cover" threshold={0.05} />
        </div>

        <div
          className="mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide"
          data-speed="0.5"
        >
          So we try to figure it out ourselves. We make pro-and-con lists at midnight. We rehearse every possible outcome. We Google symptoms at 2 a.m. We build contingency plans for our contingency plans. And somewhere in the middle of all that calculating, we lose our peace.
        </div>

        <div
          className="mb-elem absolute top-[5%] bottom-0 right-[5%] w-[35vw] overflow-hidden"
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.hookRight} alt="Contingency plans" className="w-full h-full" imgClassName="object-contain" threshold={0.05} />
        </div>
      </div>

      {/* ── Zone 3: The Scripture ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '195vw', backgroundColor: `color-mix(in srgb, ${ov} 70%, black 8%)` }}>
        <p
          className="mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          The Scripture
        </p>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '3vw' }}
          data-speed="0.5"
        >
          Solomon wrote these words to his son, passing down wisdom he had learned at great cost. He was a king surrounded by advisors, wealth, and intellectual resources beyond what most people could imagine. If anyone could have leaned on his own understanding, it was Solomon. And yet the charge he gives is this: &ldquo;Lean not on your own understanding.&rdquo;
        </div>

        {/* Gallery row */}
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.scripture1} alt="Solomon's charge" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.scripture2} alt="Sha'an — resting weight" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '111vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.scripture3} alt="Around the corner" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '149vw' }}
          data-speed="0.5"
        >
          The Hebrew word for &ldquo;lean&rdquo; is <em className="not-italic font-['Cormorant_Garamond'] italic">sha&rsquo;an</em>, which pictures a person putting the full weight of their body against something for support. Solomon is not saying, &ldquo;Don&rsquo;t think.&rdquo; He is saying, &ldquo;Don&rsquo;t let your understanding be the thing you rest your whole weight on.&rdquo; Because your understanding, no matter how sharp, is finite. It cannot see around the corner.
        </div>
      </div>

      {/* ── Zone 4: Straight Paths + Timeless Principle ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '200vw', backgroundColor: `color-mix(in srgb, ${ov} 85%, var(--app-bg))` }}>
        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '5vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.principle1} alt="Level enough to walk" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '43vw' }}
          data-speed="0.5"
        >
          And notice the promise that follows: &ldquo;He will make your paths straight.&rdquo; The Hebrew here does not mean that the road will be free of difficulty. It means He will make the path level enough for you to walk. He clears the way, one step at a time, for the one who trusts Him more than their own map.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '70vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.principle2} alt="One step at a time" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <p
          className="mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          The Timeless Principle
        </p>

        <h3
          className="mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]"
          style={{ left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' }}
          data-speed="0.5"
        >
          Serenity does not come from knowing the whole plan; it comes from knowing the One who holds it.
        </h3>

        <div
          className="mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide"
          style={{ left: '118vw' }}
          data-speed="0.5"
        >
          Trust is not the absence of questions&mdash;it is the choice to submit our questions to a God who is wiser than our answers. When we stop leaning on what we can figure out and lean instead on who He is, He quietly straightens paths we could never have engineered ourselves.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '155vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.principle3} alt="Path straightened" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 5: The Application ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '190vw', backgroundColor: `color-mix(in srgb, ${ov} 75%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          The Application
        </p>

        <div
          className="mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Think of one decision or unknown that has been stealing your peace. Write it down. Now ask yourself honestly: Have I been trying to lean on my own understanding of this? Have I been demanding clarity from God before I will give Him trust? Today, reverse the order. Offer Him your trust first&mdash;before the clarity comes.
        </div>

        <div
          className="mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          &ldquo;Lord, I don&rsquo;t understand. And I trust You anyway.&rdquo;
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.application1} alt="Naming the unknown" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '73vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.application2} alt="The next small step" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>

        <div
          className="mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide"
          style={{ left: '114vw' }}
          data-speed="0.5"
        >
          Speak it out loud: &ldquo;Lord, I don&rsquo;t understand. And I trust You anyway.&rdquo; Then take the very next small step of obedience that is in front of you, and leave the rest of the path in His hands. Serenity grows in the soil of surrendered understanding.
        </div>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '141vw', width: '35vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.application3} alt="Surrendered understanding" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 6: Prayer ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: `color-mix(in srgb, ${ov} 90%, black 5%)` }}>
        <p
          className="mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          A Prayer for Serenity
        </p>

        <div
          className="mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]"
          style={{ left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' }}
          data-speed="0.5"
        >
          Father, I confess that I have been trying to carry what was never mine to carry&mdash;the future, the outcome, the full picture. I have leaned so heavily on my own understanding that I have worn myself out. Today, I shift my weight onto You. I trust You with what I cannot see. I trust You with what I cannot fix. Make my path straight, one faithful step at a time. Teach me the serenity of a heart that rests in Your wisdom instead of its own. Amen.
        </div>

        <p
          className="mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50"
          style={{ left: '5vw' }}
          data-speed="0.5"
        >
          Proverbs 3:5&ndash;6 &mdash; Serenity of Trust
        </p>

        <div
          className="mb-elem absolute top-[4%] bottom-0 overflow-hidden"
          style={{ left: '35vw', width: '55vw' }}
          data-speed="0.5"
        >
          <PhotoDevelopImage src={T.prayer} alt="Rest in His wisdom" className="w-full h-full" imgClassName="object-contain" revealed />
        </div>
      </div>

      {/* ── Zone 7: CTA ── */}
      <RestorationCTA purposeWord="Serenity" overlayColor={ov} />

      {/* ── Zone 8: Next Devotion Hero ── */}
      <div className="relative flex-shrink-0 h-screen" style={{ width: '100vw', backgroundColor: nextProject.overlayColor }}>
        <div className="grid grid-cols-2 h-full">
          <div className="relative flex flex-col justify-start px-16 pt-28 pb-20">
            <p className="text-xs tracking-[0.25em] uppercase text-white/50 mb-10">
              Next Devotion
            </p>
            <h3
              className="font-['Cormorant_Garamond'] italic font-light text-white/90 tracking-tight mb-12"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)', lineHeight: 0.95 }}
            >
              {nextProject.name}
            </h3>
            {nextProject.description && (
              <p className="text-lg text-white/60 max-w-md leading-relaxed">
                {nextProject.description}
              </p>
            )}
          </div>
          <div className="relative h-full overflow-hidden">
            <PhotoDevelopImage
              src={nextProject.thumbnail}
              alt={nextProject.name}
              className="w-full h-full"
              threshold={0.05}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   TRUST MOBILE — vertical devotional stack
   ════════════════════════════════════════════════════════════════ */

function TrustMobile({ project }: { project: Project }) {
  const bg = project.overlayColor;
  const bgLight = `color-mix(in srgb, ${bg} 85%, var(--app-bg))`;
  const bgDark = `color-mix(in srgb, ${bg} 75%, black 8%)`;

  return (
    <div style={{ backgroundColor: bg }}>
      {/* Trust Title */}
      <section className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs">
          Let&rsquo;s explore the weight you were never meant to carry on your own understanding.
        </p>
        <h2
          className="font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]"
          style={{ fontSize: 'clamp(4rem, 18vw, 10rem)', paddingBottom: '0.18em' }}
        >
          Trust
        </h2>
        <div className="w-10 h-px bg-white/20 mt-10" />
      </section>

      {/* Opening — image + text */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgLight }}>
        <PhotoDevelopImage src={T.hero} alt="The path made straight" className="w-full aspect-[2/3] mb-10" />
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8">
          The heart was never designed to carry the weight of knowing everything.
        </h3>
        <p className="text-sm text-white/60 leading-[1.85] mb-6">
          Most of us are not struggling with whether God exists. We are struggling with whether God can be trusted with the specific, tender, uncertain parts of our lives. The decision that feels too big. The child we cannot fix. The diagnosis we did not see coming. The door that will not open no matter how hard we knock.
        </p>
        <p className="text-sm text-white/50 leading-[1.85]">
          So we try to figure it out ourselves. We make pro-and-con lists at midnight. We rehearse every possible outcome. We Google symptoms at 2 a.m. We build contingency plans for our contingency plans. And somewhere in the middle of all that calculating, we lose our peace.
        </p>
      </section>

      {/* Scripture */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Scripture</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Solomon wrote these words to his son, passing down wisdom he had learned at great cost. He was a king surrounded by advisors, wealth, and intellectual resources beyond what most people could imagine. If anyone could have leaned on his own understanding, it was Solomon. And yet the charge he gives is this: &ldquo;Lean not on your own understanding.&rdquo;
        </p>
        <PhotoDevelopImage src={T.scripture1} alt="Solomon's charge" className="w-full aspect-[2/3] mb-8" />
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          The Hebrew word for &ldquo;lean&rdquo; is <em className="not-italic font-['Cormorant_Garamond'] italic">sha&rsquo;an</em>, which pictures a person putting the full weight of their body against something for support. Solomon is not saying, &ldquo;Don&rsquo;t think.&rdquo; He is saying, &ldquo;Don&rsquo;t let your understanding be the thing you rest your whole weight on.&rdquo; Because your understanding, no matter how sharp, is finite. It cannot see around the corner.
        </p>
        <PhotoDevelopImage src={T.scripture2} alt="Sha'an" className="w-full aspect-video mb-8" />
        <p className="text-sm text-white/60 leading-[1.85]">
          And notice the promise that follows: &ldquo;He will make your paths straight.&rdquo; The Hebrew here does not mean that the road will be free of difficulty. It means He will make the path level enough for you to walk. He clears the way, one step at a time, for the one who trusts Him more than their own map.
        </p>
      </section>

      {/* Image pair */}
      <section className="grid grid-cols-2 gap-2 p-6" style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={T.hookLeft} alt="Midnight uncertainty" className="w-full aspect-[2/3]" />
        <PhotoDevelopImage src={T.principle1} alt="Level enough to walk" className="w-full aspect-[2/3]" />
      </section>

      {/* Timeless Principle */}
      <section className="p-6 py-20" style={{ backgroundColor: bgLight }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Timeless Principle</p>
        <h3 className="font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8">
          Serenity does not come from knowing the whole plan; it comes from knowing the One who holds it.
        </h3>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Trust is not the absence of questions&mdash;it is the choice to submit our questions to a God who is wiser than our answers. When we stop leaning on what we can figure out and lean instead on who He is, He quietly straightens paths we could never have engineered ourselves.
        </p>
        <PhotoDevelopImage src={T.principle2} alt="One step at a time" className="w-full aspect-[3/2]" />
      </section>

      {/* Application */}
      <section className="p-6 pb-16" style={{ backgroundColor: bgDark }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-10">The Application</p>
        <p className="text-sm text-white/60 leading-[1.85] mb-8">
          Think of one decision or unknown that has been stealing your peace. Write it down. Now ask yourself honestly: Have I been trying to lean on my own understanding of this? Have I been demanding clarity from God before I will give Him trust? Today, reverse the order. Offer Him your trust first&mdash;before the clarity comes.
        </p>
        <div className="font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed">
          &ldquo;Lord, I don&rsquo;t understand. And I trust You anyway.&rdquo;
        </div>
        <p className="text-sm text-white/50 leading-[1.85] mb-10">
          Speak it out loud, then take the very next small step of obedience that is in front of you, and leave the rest of the path in His hands. Serenity grows in the soil of surrendered understanding.
        </p>
        <PhotoDevelopImage src={T.application1} alt="Naming the unknown" className="w-full aspect-[2/3]" />
      </section>

      {/* Prayer */}
      <section className="p-6 py-20 text-center" style={{ backgroundColor: bg }}>
        <p className="text-xs tracking-[0.3em] uppercase text-white/35 mb-12">A Prayer for Serenity</p>
        <p className="font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12">
          Father, I confess that I have been trying to carry what was never mine to carry&mdash;the future, the outcome, the full picture. I have leaned so heavily on my own understanding that I have worn myself out. Today, I shift my weight onto You. I trust You with what I cannot see. I trust You with what I cannot fix. Make my path straight, one faithful step at a time. Teach me the serenity of a heart that rests in Your wisdom instead of its own. Amen.
        </p>
        <PhotoDevelopImage src={T.prayer} alt="Rest in His wisdom" className="w-full aspect-[2/3]" />
      </section>

      {/* Final image */}
      <section style={{ backgroundColor: bg }}>
        <PhotoDevelopImage src={T.closing} alt="Serenity of trust" className="w-full aspect-video" />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DEFAULT MOBILE — existing generic fallback
   ════════════════════════════════════════════════════════════════ */

function MoodBoardMobile({ project }: { project: Project }) {
  const label = categoryLabel[project.category];

  return (
    <div style={{ backgroundColor: project.overlayColor }}>
      {/* Zone 1: Hero */}
      <section className="min-h-screen p-6 flex flex-col justify-center">
        <PhotoDevelopImage
          src={project.thumbnail}
          alt={project.name}
          className="w-full h-[60vh] mb-8"
        />
        <h2 className="text-[15vw] font-bold text-white/90 leading-none mb-4">
          {project.name.toUpperCase()}
        </h2>
        <p className="text-sm text-white/60 leading-relaxed max-w-sm">
          {project.description || 'A space where architecture meets editorial design.'}
        </p>
      </section>

      {/* Zone 2: Data */}
      <section className="min-h-screen p-6 flex flex-col justify-center">
        <div className="bg-white p-4 shadow-lg w-fit mb-8">
          <PhotoDevelopImage
            src={project.images[1] || project.thumbnail}
            alt={`${project.name} detail`}
            className="w-[240px] h-[300px]"
          />
          <p className="text-xs mt-3 text-black/60">
            {project.location || 'Location'} — {project.year || '2025'}
          </p>
        </div>
        {project.area && (
          <div className="text-[20vw] font-bold text-white/10 mb-8">{project.area}m²</div>
        )}
        {project.services && (
          <div className="space-y-3 text-sm">
            {project.services.map((service, i) => (
              <div key={service.id} className="flex gap-3">
                <span className="text-white/40">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-white/70">{service.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Zone 3: Craft */}
      <section className="min-h-screen p-6 flex flex-col justify-center">
        <h3 className="text-[15vw] font-bold text-white leading-none mb-8">CRAFT</h3>
        <PhotoDevelopImage
          src={project.images[3] || project.images[1] || project.thumbnail}
          alt={`${project.name} craft`}
          className="w-full h-[40vh] mb-8"
        />
        <p className="text-white/80 text-sm leading-relaxed">
          {project.description || 'Every detail matters. From material selection to spatial flow, we consider how spaces evolve with their inhabitants.'}
        </p>
      </section>

      {/* Zone 4: Year */}
      <section className="min-h-screen p-6 flex flex-col justify-center">
        <div className="text-[20vw] font-bold text-white/15 mb-8">{project.year || '2025'}</div>
        <PhotoDevelopImage
          src={project.images[5] || project.thumbnail}
          alt={`${project.name} featured`}
          className="w-full h-[50vh] mb-4"
        />
        <p className="text-white text-xs tracking-widest uppercase">{label}</p>
      </section>

      {/* Zone 5: CTA */}
      <section className="min-h-screen p-6 flex flex-col justify-center items-center text-center">
        <h3 className="text-[12vw] font-bold text-white mb-6">Let's Talk</h3>
        <p className="text-white/70 text-sm mb-8 max-w-sm">
          Ready to create something extraordinary? Reach out and let's start a conversation about your next project.
        </p>
        <button className="px-8 py-4 bg-white text-mersi-dark text-sm">Get in Touch</button>
      </section>
    </div>
  );
}
