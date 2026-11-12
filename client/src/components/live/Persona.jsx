import { useApp } from '../../context/AppContext.jsx';
import RobotPersona from './RobotPersona.jsx';
import CharacterPersona from './CharacterPersona.jsx';

export default function Persona(props) {
  const { settings } = useApp();
  return settings.personaMode === 'character' ? <CharacterPersona {...props} /> : <RobotPersona {...props} />;
}