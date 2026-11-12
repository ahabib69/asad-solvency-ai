import { useApp } from '../../context/AppContext.jsx';
import RobotPersona from './RobotPersona.jsx';
import CharacterPersona from './CharacterPersona.jsx';

// Picks the Live AI avatar from Settings → Appearance ("character" is the default).
export default function Persona(props) {
  const { settings } = useApp();
  return settings.persona === 'robot' ? <RobotPersona {...props} /> : <CharacterPersona {...props} />;
}
