// Building blocks from the "wireframe to hi-fi" design system, shared by the redesigned pages
// (landing, bystander report, auth, ERT, admin), set in Figtree + Spline Sans Mono. Colours come
// from the theme tokens in globals.css, so the controls work in light and dark mode.

export { Banner } from './banner';
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
export { formatCoordinates } from './format';
export { LocationPicker, type PickedLocation } from './location-picker';
export {
  UNKNOWN_PERSON,
  casualtiesMeta,
  missingPersonsMeta,
  personMeta,
  type CasualtyEntry,
  type PersonEntry,
  type PersonSex,
} from './people';
export { PeopleDrawer } from './people-drawer';
export { PrivacyDrawer } from './privacy-drawer';
export { OTHER_OPTION, OTHER_VALUE, Select, type SelectOption } from './select';
export { Switch, SwitchField } from './switch';
