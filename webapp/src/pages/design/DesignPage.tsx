import { v4 as uuidv4 } from 'uuid';
import React, { useState, useCallback, useEffect, useContext } from 'react';
import { Button, Flex, useDisclosure, useToast } from '@chakra-ui/react';
import {
  Node,
  Edge,
  Connection,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
} from 'react-flow-renderer';
import { MdOutlineFeedback } from "react-icons/md";
import TopPanel from './TopPanel';
import Toolbox from '../../components/Toolbox';
import Canvas from '../../components/Canvas';
import PropertyPanel from '../../components/PropertyPanel';
import { ToolboxItem } from '../../interfaces/ToolboxItem';
import PromptModal from '../../components/PromptModal';
import WalkthroughDialog from '../../components/WalkthroughDialog';
import FeedbackForm from '../../components/FeedbackForm';
import { FaQuestion } from 'react-icons/fa';
import { initGA, logPageView } from '../../utils/analytics';
import genStructure from '../../prompts/genStructure';
import { promptAI } from '../../services/prompt';
import LoadingModal from '../../components/LoadingModal';
import { FileTreeItemType } from '../../interfaces/file';
import { saveProject } from '../../utils/projectUtils';

import { todoproject } from '../../data/mock';
import { loadItem } from '../../utils/itemFactory';
import ListProject from './ListProject';
import { projectApi } from '../../api/project';
import ProjectBanner from './ProjectBanner';
import { predefinedProjects } from '../../interfaces/example';
import { SaveProjectResponse } from '../../interfaces/project';
import { createItem } from '../../utils/itemFactory';
import { TaskModal } from './TaskModal';
import { useProjectContext } from '../../contexts/ProjectContext';
import InputModal from '../../components/InputModal';
import { logout } from '../../services/authApi';  
import { Wallet, WalletCreationModal } from '../../components/Wallet';
import { AuthContext } from '../../contexts/AuthContext';

const GA_MEASUREMENT_ID = 'G-L5P6STB24E';
const isProduction = (process.env.REACT_APP_ENV || 'development') === 'production';

function setFileTreePaths(
  item: FileTreeItemType,
  parentPath: string = ''
): void {
  const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;
  item.path = currentPath;

  if (item.children) {
    for (const child of item.children) {
      setFileTreePaths(child, currentPath);
    }
  }
}

const DesignPage: React.FC = () => {
  const { projectContext, setProjectContext } = useProjectContext();
  const isSaveDisabled = !projectContext || !projectContext.id || !projectContext.name || !projectContext.details;

  const [aiModel, setAiModel] = useState('codestral-latest');
  const [apiKey, setApiKey] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptString, setPromptString] = useState<any>({});
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  const [isFeedbackFormOpen, setIsFeedbackFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const { user, firstLoginAfterRegistration, markWalletModalViewed } = useContext(AuthContext)!;
  const [showWalletModal, setShowWalletModal] = useState(firstLoginAfterRegistration);
  const [loadingExample, setLoadingExample] = useState(false);

  const [isListProjectModalShown, setIsListProjectModalShown] = useState(false);
  const {
    isOpen: isProjectBannerOpen,
    onClose: closeProjectBanner,
    onOpen: openProjectBanner,
  } = useDisclosure();
  const toast = useToast();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const handleSelectModel = (model: string, apiKey: string) => {
    setAiModel(model);
    console.log('handleselectmodel model:', model);
    console.log('handleselectmodel apiKey:', apiKey);
    setProjectContext({ ...projectContext, aiModel: model });
  };
  
  const onNodesChange = useCallback((changes: any) => {
    setProjectContext((prevProjectContext) => ({
      ...prevProjectContext,
      details: {
        ...prevProjectContext.details,
        nodes: applyNodeChanges(changes, prevProjectContext.details.nodes),
      },
    }));
  }, [setProjectContext]);

  const onEdgesChange = useCallback((changes: any) => {
    setProjectContext((prevProjectContext) => ({
      ...prevProjectContext,
      details: {
        ...prevProjectContext.details,
        edges: applyEdgeChanges(changes, prevProjectContext.details.edges),
      },
    }));
  }, [setProjectContext]);

  const onConnect = useCallback((connection: Connection) => {
    setProjectContext((prevProjectContext) => ({
      ...prevProjectContext,
      details: {
        ...prevProjectContext.details,
        edges: addEdge(connection, prevProjectContext.details.edges),
      },
    }));
  }, [setProjectContext]);

  const handleSelectNode = (node: Node | null) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const handleSelectEdge = (edge: Edge | null) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const handleDeleteNode = (id: string) => {
    setProjectContext((prevProjectContext) => ({
      ...prevProjectContext,
      details: {
        ...prevProjectContext.details,
        nodes: prevProjectContext.details.nodes.filter((node) => node.id !== id),
      },
    }));
    setSelectedNode(null);
  };

  const handleDeleteEdge = (id: string) => {
    setProjectContext((prevProjectContext) => ({
      ...prevProjectContext,
      details: {
        ...prevProjectContext.details,
        edges: prevProjectContext.details.edges.filter((edge) => edge.id !== id),
      },
    }));
    setSelectedEdge(null);
  };

  const handleUpdateNode = (updatedNode: Node) => {
    const oldNode = projectContext.details.nodes.find((node) => node.id === updatedNode.id);
    const newOwnerProgramId = (updatedNode.data.localValues as any).ownerProgramId;
    const oldOwnerProgramId = oldNode && (oldNode.data.item as any).ownerProgramId;
    
    if (newOwnerProgramId !== oldOwnerProgramId) {
      if (oldOwnerProgramId) {
        setProjectContext((prevProjectContext) => ({
          ...prevProjectContext,
          details: {
            ...prevProjectContext.details,
            edges: prevProjectContext.details.edges.filter(
              (edge) =>
                !(
                  edge.source === oldOwnerProgramId &&
                  edge.target === updatedNode.id
                )
            ),
          },
        }));
      }

      if (newOwnerProgramId) {
        const newEdge: Edge = {
          id: uuidv4(),
          source: newOwnerProgramId,
          target: updatedNode.id,
          type: 'solana',
          animated: false,
          style: { stroke: '#ff0072', cursor: 'pointer', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.Arrow,
            color: '#ff0072',
            strokeWidth: 2,
          },
        };
        setProjectContext((prevProjectContext) => ({
          ...prevProjectContext,
          details: {
            ...prevProjectContext.details,
            edges: [...prevProjectContext.details.edges, newEdge],
          },
        }));
      }
    }
    const item = updatedNode.data.item as ToolboxItem;
    item.setPropertyValues(updatedNode.data.localValues);

    const updatedNodes = projectContext.details.nodes.map((node) =>
      node.id === updatedNode.id ? updatedNode : node
    );
    
    setProjectContext((prevProjectContext) => ({
      ...prevProjectContext,
      details: {
        ...prevProjectContext.details,
        nodes: updatedNodes,
      }
    }));
    setSelectedNode(updatedNode);
  };

  const handleUpdateEdge = (updatedEdge: Edge) => {
    setProjectContext((prevProjectContext) => ({
      ...prevProjectContext,
      details: {
        ...prevProjectContext.details,
        edges: prevProjectContext.details.edges.map((edge) => (edge.id === updatedEdge.id ? updatedEdge : edge)),
      },
    }));
    setSelectedEdge(updatedEdge);
  };

  const handleAddNode = (newNode: Node) => {
    setProjectContext((prevProjectContext) => ({
      ...prevProjectContext,
      details: {
        ...prevProjectContext.details,
        nodes: [...prevProjectContext.details.nodes, newNode],
      },
    }));
  };

  const handlePrompt = () => {
    setIsTaskModalOpen((prev) => !prev);
  };

  const handleInputModal = () => {
    setIsInputModalOpen(true);
  };

  const handleCloseWalkthrough = () => {
    setIsWalkthroughOpen(false);
  };

  const handleOpenWalkthrough = () => {
    setIsWalkthroughOpen(true);
  };

  const handleOpenFeedbackForm = () => {
    setIsFeedbackFormOpen(true);
  };

  useEffect(() => {
    const hasSeenWalkthrough = sessionStorage.getItem('hasSeenWalkthrough');
    if (!hasSeenWalkthrough) {
      setIsWalkthroughOpen(true);
      sessionStorage.setItem('hasSeenWalkthrough', 'true');
    }
    if (isProduction) {
      initGA(GA_MEASUREMENT_ID);
      logPageView();
    }
  }, []);

  const handleOpenClick = () => {
    setIsListProjectModalShown(true);
  };

  const handleSaveClick = async () => {
    const response = await saveProject(projectContext, setProjectContext);
    if (response) {
      toast({
        title: 'Project saved',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
    } else {
      toast({
        title: 'Please enter a project name and description',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const handleNewClick = async () => {
    setIsLoading(true);
    try {
      setProjectContext((prevProjectContext) => ({
        ...prevProjectContext,
        id: '',
        rootPath: '',
        name: '',
        description: '',
        aiModel: 'codestral-latest',
        apiKey: '',
        details: {
          ...prevProjectContext.details,
          nodes: [],
          edges: [],
          files: { name: '', children: [] },
          codes: [],
          docs: [],
          isSaved: false,
          isAnchorInit: false,
          isCode: false,
          aiFilePaths: [],
          aiStructure: '',
          stateContent: '',
        },
      }));
    } 
    catch (error) { console.error('Error creating new project:', error); } 
    finally { setIsLoading(false); }
  };

  const handleLoadProject = async (projectId: string, projectName: string) => {
    setIsLoading(true);
    try {
      const fetchedProject = await projectApi.getProjectDetails(projectId);
      //console.log("fetchedProject", fetchedProject);

      setProjectContext((prevProjectContext) => {
        const nodesWithTypedItems = fetchedProject.details.nodes.map((node: Node) => ({
          ...node,
          data: {
            ...node.data,
            item: createItem(node.data.item.type, node.data.item),
          },
        }));
        //console.log("nodesWithTypedItems", nodesWithTypedItems);
      
        return {
          ...prevProjectContext,
          id: fetchedProject.id,
          name: fetchedProject.name,
          description: fetchedProject.description,
          rootPath: fetchedProject.root_path,
          details: {
            ...prevProjectContext.details,
            nodes: nodesWithTypedItems || [],
            edges: fetchedProject.details.edges || [],
            isAnchorInit: fetchedProject.details.isAnchorInit,
            isCode: fetchedProject.details.isCode,
            aiFilePaths: fetchedProject.details.aiFilePaths,
            uiResults: fetchedProject.details.uiResults,
            aiInstructions: fetchedProject.details.aiInstructions,
            sdkFunctions: fetchedProject.details.sdkFunctions,
            buildStatus: fetchedProject.details.buildStatus,
            deployStatus: fetchedProject.details.deployStatus,
            isSdk: fetchedProject.details.isSdk,
            isUi: fetchedProject.details.isUi,
            genUiClicked: fetchedProject.details.genUiClicked,
            idl: fetchedProject.details.idl,
            sdk: fetchedProject.details.sdk,
            isSaved: fetchedProject.details.isSaved,
            files: { name: '', children: [] },
            codes: [],
            programId: fetchedProject.details.programId,
          },
        };
      });
      

    } catch (e) {
      toast({
        title: 'Something went wrong!',
        description: `Cannot load ${projectName} project`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
      handleCloseWalkthrough();
    }
  };

  const toggleTaskModal = () => {
    setIsTaskModalOpen((prev) => !prev);
  };

  const toggleInputModal = () => {
    setIsInputModalOpen((prev) => !prev);
  };

  const handleLogout = useCallback(() => {
    logout();
    toast({
      title: 'Logged out successfully',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    window.location.href = '/';
  }, [toast]);

  const handleToggleWallet = () => {
    setShowWallet((prev) => !prev);
  };

  const handleModalClose = () => {
    setShowWalletModal(false);
    markWalletModalViewed();
  };

  const handleExampleChange = (exampleName: string) => {
    if (exampleName && predefinedProjects[exampleName]) {
      const selectedProject = predefinedProjects[exampleName];
      setProjectContext({
        ...projectContext,
        ...selectedProject,
        aiModel: projectContext.aiModel || 'codestral-latest',
      });
    }
  };

  useEffect(() => {
    if (projectContext && projectContext.details.nodes.length > 0 && !loadingExample) {
      const { nodes: contextNodes, edges: contextEdges } = projectContext.details;
  
      const tmpNodes = contextNodes
        .map((node) => {
          const item = loadItem(node.data.item.type, node.data.item);
          if (item) {
            const newNode = item.toNode({
              x: node.position.x,
              y: node.position.y,
            });
            if (newNode) {
              newNode.id = node.id;
              return newNode;
            }
          }
          return null;
        })
        .filter((node): node is Node => node !== null);
  
      setProjectContext((prevProjectContext) => ({
        ...prevProjectContext,
        details: {
          ...prevProjectContext.details,
          nodes: tmpNodes,
          edges: contextEdges,
        },
      }));
    }
  }, [projectContext.details.nodes]);
  
  
  useEffect(() => {
    if (!loadingExample) {
      setProjectContext((prevProjectContext) => ({
        ...prevProjectContext,
        details: {
          ...prevProjectContext.details,
          nodes: projectContext.details.nodes,
          edges: projectContext.details.edges,
        }
      }));
    }
    console.log('projectContext:', projectContext);
  }, [projectContext.details.nodes, projectContext.details.edges, setProjectContext, loadingExample]);

  useEffect(() => {
    console.log('user:', user);
  }, [user]);

  return (
    <>
      <PromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        content={promptString}
      />
      <WalkthroughDialog
        isOpen={isWalkthroughOpen}
        onClose={handleCloseWalkthrough}
      />
      <FeedbackForm
        isOpen={isFeedbackFormOpen}
        onClose={() => setIsFeedbackFormOpen(false)}
      />
      <Flex direction='column' height='100vh'>
        <ProjectBanner
          isOpen={isListProjectModalShown}
          onClickSave={() => {}}
          closeBanner={closeProjectBanner}
          project={projectContext}
        />
        <TopPanel
          generatePrompt={handlePrompt}
          onClickInput={handleInputModal} 
          onClickNew={handleNewClick}
          onClickOpen={handleOpenClick}
          onClickSave={handleSaveClick}
          onLogout={handleLogout}
          onToggleWallet={handleToggleWallet}
          onSelectModel={handleSelectModel}
        />
        <Flex flex={1}>
         {firstLoginAfterRegistration && <WalletCreationModal userId={user!.id} onClose={handleModalClose} />}
          <Toolbox onExampleChange={handleExampleChange} />
          <Canvas
            nodes={projectContext.details.nodes}
            edges={projectContext.details.edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectNode={handleSelectNode}
            onSelectEdge={handleSelectEdge}
            onAddNode={handleAddNode}
          />
          {showWallet && <Wallet />}
          <PropertyPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onDeleteNode={handleDeleteNode}
            onDeleteEdge={handleDeleteEdge}
            onUpdateNode={handleUpdateNode}
            onUpdateEdge={handleUpdateEdge}
            programs={projectContext.details.nodes.filter((node) => node.type === 'program')}
            nodes={projectContext.details.nodes}
          />
        </Flex>
        
          <Button
            position='fixed'
            bottom='4'
            right='10'
            boxSizing='border-box'
            bg="white"
            border="2.5px solid"
            borderColor="#a9b7ff"
            shadow="lg"
            color="#a9b7ff"
            cursor="pointer !important"
            onClick={handleOpenWalkthrough}
            leftIcon={<FaQuestion />}
            style={{ zIndex: 100 }}
            _hover={{ bg: '#a9b7ff', color: 'white', border: '2.5px solid transparent' }}
            zIndex={100}
          >
            Help
          </Button>
          <Button
            position='fixed'
            bottom='4'
            right='40'
            boxSizing='border-box'
            bg="white"
            border="2.5px solid"
            borderColor="#a9b7ff"
            shadow="lg"
            color="#a9b7ff"
            cursor="pointer !important"
            onClick={handleOpenFeedbackForm}
            _hover={{ bg: '#a9b7ff', color: 'white', border: '2.5px solid transparent' }}
            leftIcon={<MdOutlineFeedback size={20}/>}
            zIndex={100}
          >
            Feedback
          </Button>
      </Flex>
      <ListProject
        isOpen={isListProjectModalShown}
        onClose={() => setIsListProjectModalShown(false)}
        onProjectClick={handleLoadProject}
      />
      <LoadingModal isOpen={isLoading} onClose={() => setIsLoading(false)} />
      <TaskModal isOpen={isTaskModalOpen} onClose={toggleTaskModal} />
      <InputModal isOpen={isInputModalOpen} onClose={toggleInputModal} />
    </>
  );
};

export default DesignPage;
