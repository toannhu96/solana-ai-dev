import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import {
  Flex,
  Button,
  Avatar,
  Box,
  Text,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  Divider,
  Tooltip,
  Input,
} from '@chakra-ui/react';
import { ChevronDownIcon, EditIcon } from '@chakra-ui/icons';
import { Check, FolderOpen, Wallet, Plus, Code, Save } from 'lucide-react';
import { HiOutlineSparkles } from "react-icons/hi";
import { useProjectContext } from '../../contexts/ProjectContext';
import { useAuthContext, User } from '../../contexts/AuthContext';
import { handleGenerateUI } from '../../utils/uiUtils';
import { LogEntry } from '../../hooks/useTerminalLogs';

interface TopPanelProps {
  onToggleWallet: () => void;
  onLogout: () => void;
  setIsPolling: Dispatch<SetStateAction<boolean>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  addLog: (message: string, type: LogEntry['type']) => void;
  setIsTaskModalOpen: Dispatch<SetStateAction<boolean>>;
  user: User | null;
}

const TopPanel: React.FC<TopPanelProps> = ({
  onToggleWallet,
  onLogout,
  setIsPolling,
  setIsLoading,
  addLog,
  setIsTaskModalOpen,
  user
}) => {
  const { projectContext, setProjectContext } = useProjectContext();
  const [hover, setHover] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Codestral');
  const [apiKey, setApiKey] = useState('');

  const handleMouseEnter = () => setHover(true);
  const handleMouseLeave = () => setHover(false);

  if (!user) return null;
  return (
    <Flex direction="row" justify="space-between" align="center" bg="gray.50" borderBottomWidth="1px" borderColor="gray.300">
      <Flex flex={1} direction="row" justify="flex-start" pl={12}>
        <Button
          size="xs"
          onClick={() => {if (user) handleGenerateUI(
            projectContext.id, 
            projectContext, 
            setProjectContext, 
            setIsPolling, 
            setIsLoading, 
            addLog, 
            setIsTaskModalOpen, 
            user
          )}}
          bg="white"
          border="1px solid"
          borderColor="gray.300"
          borderRadius="md"
          shadow="sm"
          ml={12}
        >
          <Text fontSize="xs">Generate UI</Text>
        </Button>
      </Flex>
      <Flex as="header" h="14" justify="flex-end" align="center" gap={4} px={6}>
        <Flex align="center" gap={4}>
          <Button leftIcon={<Wallet size={12} />} variant="outline" size="xs" bg="white" onClick={onToggleWallet}>
            <Text fontSize="xs">Wallet</Text>
          </Button>
          <Menu>
            <MenuButton as={Button} variant="ghost" size="xs" rounded="full">
              <Avatar size="xs" src="/placeholder.svg" />
            </MenuButton>
            <MenuList w="auto">
              <MenuItem onClick={onLogout} p={0} pl={2}>
                <Text fontSize="xs">Logout</Text>
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default TopPanel;
