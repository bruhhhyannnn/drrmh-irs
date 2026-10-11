// Building blocks from the "wireframe to hi-fi" design system, shared by the redesigned pages
// (landing, bystander report, auth, ERT). Light theme only, set in Figtree + Spline Sans Mono.

export { Drawer } from './drawer';
export {
  Button,
  ButtonLink,
  FieldError,
  FieldHelp,
  FieldLabel,
  OptionTile,
  PasswordInput,
  SegmentedControl,
  SelectField,
  Stepper,
  TextArea,
  TextInput,
} from './fields';
export { FOCUS_RING } from './focus';
export { figtree, splineSansMono } from './fonts';
export {
  UNKNOWN_PERSON,
  casualtiesMeta,
  conditionSummary,
  missingPersonsMeta,
  personMeta,
  plural,
  type CasualtyEntry,
  type PersonEntry,
  type PersonSex,
} from './people';
export { PeopleDrawer } from './people-drawer';
export { PrivacyDrawer } from './privacy-drawer';
