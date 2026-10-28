import { Box, Paper, Popper } from '@mui/material';
import { useState } from 'react';
import { palette } from '@/theme';
import { FoilSheen } from '@/shared/cards/FoilSheen';

/** Row height, also the art tile width. */
export const ART_SIZE = 64;

/** Crop fractions per edge; the layout trims the longer side evenly to keep art centred. */
const CARD_ART_CROP = {
  top: 0.115,
  left: 0.1,
  right: 0.1,
  bottom: 0.485,
};

/** Scryfall images are 488x680, so this ratio is height over width. */
const CARD_IMAGE_ASPECT = 680 / 488;

/** Percent offsets scale the image; maxWidth is cleared so it can overflow on purpose. */
function artCropSx() {
  const windowWidth = 1 - CARD_ART_CROP.left - CARD_ART_CROP.right;
  const windowHeight = 1 - CARD_ART_CROP.top - CARD_ART_CROP.bottom;

  const scale = 1 / Math.min(windowWidth, windowHeight * CARD_IMAGE_ASPECT);
  const visibleWidth = 1 / scale;
  const visibleHeight = 1 / (scale * CARD_IMAGE_ASPECT);
  const offsetX = CARD_ART_CROP.left + (windowWidth - visibleWidth) / 2;
  const offsetY = CARD_ART_CROP.top + (windowHeight - visibleHeight) / 2;

  return {
    position: 'absolute',
    width: `${scale * 100}%`,
    maxWidth: 'none',
    height: 'auto',
    left: `${-offsetX * scale * 100}%`,
    top: `${-offsetY * scale * CARD_IMAGE_ASPECT * 100}%`,
  };
}

/** Hover preview is portalled so the table cannot clip it. */
export function CardArtSquare({ url, foil }: { url: string | null; foil: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Box
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse' && url) setAnchor(event.currentTarget);
        }}
        onPointerLeave={() => setAnchor(null)}
        sx={{
          width: ART_SIZE,
          height: ART_SIZE,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: palette.surfaceRaised,
        }}
      >
        {url && <Box component="img" src={url} alt="" loading="lazy" sx={artCropSx()} />}
        {foil && url && <FoilSheen />}
      </Box>

      <Popper
        open={Boolean(anchor)}
        anchorEl={anchor}
        placement="right-start"
        modifiers={[{ name: 'offset', options: { offset: [8, 0] } }]}
        sx={{ zIndex: (theme) => theme.zIndex.modal, pointerEvents: 'none' }}
      >
        <Paper
          sx={{
            p: 0.5,
            border: `1px solid ${palette.goldBorder}`,
            backgroundColor: palette.surfaceRaised,
          }}
        >
          <Box
            component="img"
            src={url ?? ''}
            alt=""
            sx={{ width: 200, display: 'block', borderRadius: 0.5 }}
          />
        </Paper>
      </Popper>
    </>
  );
}
