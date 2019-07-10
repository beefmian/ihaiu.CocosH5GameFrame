/////////////////////////////////////
// ihaiu.ExportFairyGUICode生成
// http://blog.ihaiu.com
/////////////////////////////////////

import TextArea from "../../Extends/GameGM/TextArea";

export default class TextAreaStruct extends fgui.GButton
{
	public m_title : fgui.GTextInput;

	
	public static URL:string = "ui://46xcitpdket7m";
	
	public static DependPackages:string[] = ["GameGM"];

	
	public static createInstance():TextArea {
		return <TextArea><any>(fgui.UIPackage.createObject("GameGM","TextArea"));
	}

	

	public constructor() 
	{
		super();
	}

	protected onConstruct(): void 
	{
		

		
		this.m_title = <fgui.GTextInput><any>(this.getChild("title"));
		
		

		this.constructFromXML();
	}


	protected constructFromXML(xml?: any): void 
	{

	}
}