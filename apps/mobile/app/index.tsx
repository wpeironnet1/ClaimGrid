import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { federalWorkflow } from "@claimgrid/core";

export default function Home(){const router=useRouter();return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
  <Text style={styles.kicker}>FIELD COMPANION</Text><Text style={styles.title}>Your claim work, from desk to dirt.</Text>
  <Text style={styles.copy}>Save research areas, capture corners and field notes, and keep the filing clock visible.</Text>
  <TouchableOpacity accessibilityRole="button" onPress={()=>router.push("/field")} style={styles.button}><Text style={styles.buttonText}>Open field capture</Text></TouchableOpacity>
  <View style={styles.alert}><Text style={styles.alertTitle}>Verify before acting</Text><Text style={styles.alertText}>Map layers are screening tools. Confirm official land status, existing monuments, discovery, and state requirements.</Text></View>
  <Text style={styles.section}>CLAIM WORKFLOW</Text>{federalWorkflow.map((step,index)=><View key={step.id} style={styles.step}><Text style={styles.number}>{String(index+1).padStart(2,"0")}</Text><View style={styles.stepCopy}><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.stepText}>{step.description}</Text></View></View>)}
  </ScrollView>}

const styles=StyleSheet.create({page:{backgroundColor:"#f5f1e7"},content:{padding:24,paddingTop:54},kicker:{fontSize:11,letterSpacing:2,color:"#9b583d",fontWeight:"700"},title:{fontFamily:"Georgia",fontSize:48,lineHeight:50,color:"#172018",marginTop:14},copy:{fontFamily:"Georgia",fontSize:18,lineHeight:27,color:"#465047",marginVertical:22},button:{backgroundColor:"#9b583d",padding:18,alignItems:"center"},buttonText:{color:"white",fontWeight:"700"},alert:{backgroundColor:"#172018",padding:20,marginTop:22},alertTitle:{color:"#f5f1e7",fontWeight:"700",marginBottom:8},alertText:{color:"#bdc5bb",fontSize:13,lineHeight:19},section:{fontSize:11,letterSpacing:2,color:"#9b583d",fontWeight:"700",marginTop:42,marginBottom:12},step:{flexDirection:"row",borderTopWidth:1,borderTopColor:"#17201822",paddingVertical:20},number:{fontSize:11,color:"#bc8a3c",width:38},stepCopy:{flex:1},stepTitle:{fontFamily:"Georgia",fontSize:22,color:"#172018",marginBottom:6},stepText:{fontSize:13,lineHeight:19,color:"#59645a"}});
