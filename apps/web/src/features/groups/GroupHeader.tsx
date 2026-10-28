import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import type { CardGroup } from '@opulent/shared';
import { Link as RouterLink } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface GroupHeaderProps {
  group: CardGroup;
  editing: boolean;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
  saveError?: string;
  deleteError?: string;
}

export function GroupHeader({
  group,
  editing,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  saving,
  deleting,
  saveError,
  deleteError,
}: GroupHeaderProps) {
  return (
    <Stack spacing={4}>
      <Button
        component={RouterLink}
        to="/collection"
        startIcon={<ArrowBackIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        My collection
      </Button>

      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: { sm: 'flex-start' },
          }}
        >
          <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
            {editing ? (
              <Stack spacing={1.25}>
                <Stack spacing={0.25}>
                  <Typography
                    variant="overline"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Group name
                  </Typography>
                  <TextField
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                    placeholder="Group name"
                    variant="standard"
                    fullWidth
                    slotProps={{
                      input: {
                        disableUnderline: true,
                        sx: {
                          p: 0,
                          fontSize: { xs: '2rem', sm: '2.75rem' },
                          fontWeight: 700,
                          lineHeight: 1.2,
                        },
                      },
                    }}
                  />
                </Stack>
                <Stack spacing={0.25}>
                  <Typography
                    variant="overline"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Description
                  </Typography>
                  <TextField
                    value={description}
                    onChange={(event) => onDescriptionChange(event.target.value)}
                    placeholder="Description"
                    variant="standard"
                    fullWidth
                    multiline
                    minRows={1}
                    maxRows={6}
                    slotProps={{
                      input: {
                        disableUnderline: true,
                        sx: { p: 0, fontSize: '1rem', lineHeight: 1.5 },
                      },
                    }}
                  />
                </Stack>
              </Stack>
            ) : (
              <Stack spacing={0.75}>
                <Typography variant="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  {group.name}
                </Typography>
                {group.description && (
                  <Typography
                    sx={{
                      color: 'text.secondary',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {group.description}
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            useFlexGap
            sx={{
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            {editing ? (
              <>
                <Button
                  variant="contained"
                  onClick={onSave}
                  disabled={!name.trim() || saving}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Save
                </Button>
                <Button onClick={onCancelEdit} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                  onClick={onStartEdit}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Edit
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={onDelete}
                  disabled={deleting}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Delete group
                </Button>
              </>
            )}
          </Stack>
        </Stack>

        {saveError && <Alert severity="error">{saveError}</Alert>}
        {deleteError && <Alert severity="error">{deleteError}</Alert>}
      </Stack>
    </Stack>
  );
}
