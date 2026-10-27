/** Shared outline icons for Stratos navigation (Phosphor, MIT). */
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/csr/WhatsappLogo";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { WalletIcon } from "@phosphor-icons/react/dist/csr/Wallet";
import { BuildingsIcon } from "@phosphor-icons/react/dist/csr/Buildings";
import { AtomIcon } from "@phosphor-icons/react/dist/csr/Atom";
import { RobotIcon } from "@phosphor-icons/react/dist/csr/Robot";
import { CalendarDotsIcon } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { BankIcon } from "@phosphor-icons/react/dist/csr/Bank";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { CreditCardIcon } from "@phosphor-icons/react/dist/csr/CreditCard";
import { UserCircleIcon } from "@phosphor-icons/react/dist/csr/UserCircle";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { LightbulbIcon } from "@phosphor-icons/react/dist/csr/Lightbulb";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun";
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { HexagonIcon } from "@phosphor-icons/react/dist/csr/Hexagon";
import { TargetIcon } from "@phosphor-icons/react/dist/csr/Target";
import { MegaphoneIcon } from "@phosphor-icons/react/dist/csr/Megaphone";
import { NotebookIcon } from "@phosphor-icons/react/dist/csr/Notebook";
import { UserCheckIcon } from "@phosphor-icons/react/dist/csr/UserCheck";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { StackIcon } from "@phosphor-icons/react/dist/csr/Stack";
import { FilmSlateIcon } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { TrayIcon } from "@phosphor-icons/react/dist/csr/Tray";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { ChatsCircleIcon } from "@phosphor-icons/react/dist/csr/ChatsCircle";
import { ListChecksIcon } from "@phosphor-icons/react/dist/csr/ListChecks";

const icons = {
  c: UsersIcon,
  wa: WhatsappLogoIcon,
  d: ChartLineUpIcon,
  caja: WalletIcon,
  e: BuildingsIcon,
  ia: AtomIcon,
  copilot: RobotIcon,
  a: CalendarDotsIcon,
  fa: BankIcon,
  rrhh: UserPlusIcon,
  trash: TrashIcon,
  planes: CreditCardIcon,
  perfil: UserCircleIcon,
  admin: ShieldCheckIcon,
  menu: SquaresFourIcon,
  add: PlusIcon,
  intel: LightbulbIcon,
  plan: CalendarBlankIcon,
  sun: SunIcon,
  moon: MoonIcon,
  exit: SignOutIcon,
  search: MagnifyingGlassIcon,
  bell: BellIcon,
  lp: HexagonIcon,
  miespacio: TargetIcon,
  mkt: MegaphoneIcon,
  mkt_reporte: NotebookIcon,
  mkt_equipo: UserCheckIcon,
  mkt_dia: CalendarCheckIcon,
  mkt_marcas: StackIcon,
  mkt_pipe: FilmSlateIcon,
  mkt_sol: TrayIcon,
  midrive: FolderOpenIcon,
  chat: ChatsCircleIcon,
  rails: ListChecksIcon,
  mi_espacio: CalendarBlankIcon,
};

// Keep the same open contours in selected and resting states, like the rail reference.
// Selection is communicated by the enclosing control and its foreground color.
export function StratosIcon({ name, size = 24, color = "currentColor", style, title, ...rest }) {
  const Icon = icons[name] || SquaresFourIcon;
  return (
    <Icon
      {...rest}
      size={size}
      weight="regular"
      color={color}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      {title ? <title>{title}</title> : null}
    </Icon>
  );
}
